import os
import json
import argparse
import time
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
try:
    from ultrasound_model import KidneyUltrasoundCNN
    from ultrasound_dataset import KidneyUltrasoundDataset, get_transforms
except ImportError:
    from api.ultrasound_model import KidneyUltrasoundCNN
    from api.ultrasound_dataset import KidneyUltrasoundDataset, get_transforms

def set_seed(seed=42):
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

def train_epoch(model, loader, criterion, optimizer, device):
    # one full pass over the training set: forward, loss, backward, optimizer step, per batch
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for inputs, targets in loader:
        inputs, targets = inputs.to(device), targets.to(device)

        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * inputs.size(0)  # weight by batch size since the last batch may be smaller
        _, predicted = outputs.max(1)
        total += targets.size(0)
        correct += predicted.eq(targets).sum().item()

    epoch_loss = running_loss / total
    epoch_acc = correct / total
    return epoch_loss, epoch_acc

def evaluate(model, loader, criterion, device):
    # same as train_epoch but no gradient tracking/optimizer step, used for both val and test sets
    model.eval()
    running_loss = 0.0
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for inputs, targets in loader:
            inputs, targets = inputs.to(device), targets.to(device)
            outputs = model(inputs)
            loss = criterion(outputs, targets)

            running_loss += loss.item() * inputs.size(0)
            _, predicted = outputs.max(1)

            all_preds.extend(predicted.cpu().numpy())
            all_targets.extend(targets.cpu().numpy())

    val_loss = running_loss / len(loader.dataset)

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)

    acc = accuracy_score(all_targets, all_preds)
    # macro average so all 5 classes count equally, even if one pathology is rarer in the sample
    precision, recall, f1, _ = precision_recall_fscore_support(
        all_targets, all_preds, average='macro', zero_division=0
    )
    
    metrics = {
        "loss": val_loss,
        "accuracy": acc,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "predictions": all_preds.tolist(),
        "targets": all_targets.tolist()
    }
    return metrics

def train_model(args):
    set_seed(args.seed)
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    # 1. Dataset & Loaders
    train_transform, val_transform = get_transforms()
    
    # If run in quick mode, use small datasets
    if args.quick:
        train_samples = 64
        val_samples = 32
        test_samples = 32
        epochs = 1
        print(">>> Quick Mode Active: Using small subsets to verify training script.")
    else:
        train_samples = args.num_samples_train
        val_samples = args.num_samples_val
        test_samples = args.num_samples_test
        epochs = args.epochs
        
    print(f"Creating synthetic datasets (Train: {train_samples}, Val: {val_samples}, Test: {test_samples})...")
    # big seed offsets so val/test synthetic images never collide with train ones
    train_dataset = KidneyUltrasoundDataset(num_samples=train_samples, transform=train_transform, seed=args.seed)
    val_dataset = KidneyUltrasoundDataset(num_samples=val_samples, transform=val_transform, seed=args.seed + 10000)
    test_dataset = KidneyUltrasoundDataset(num_samples=test_samples, transform=val_transform, seed=args.seed + 20000)
    
    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, drop_last=True)  # avoid a tiny final batch messing with batchnorm stats
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)
    
    # 2. Setup Device & Model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # skip downloading pretrained imagenet weights in quick mode, keeps the smoke test fast and offline-friendly
    pretrained = not args.quick
    model = KidneyUltrasoundCNN(num_classes=5, pretrained=pretrained)
    model = model.to(device)

    # 3. Optimizer & Criterion & Scheduler
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)  # lr decays to ~0 by the last epoch
    
    # 4. Training Loop
    history = {
        "train_loss": [],
        "train_acc": [],
        "val_loss": [],
        "val_acc": [],
        "val_precision": [],
        "val_recall": [],
        "val_f1": []
    }
    
    best_val_f1 = 0.0
    start_time = time.time()
    
    print("Beginning Training Loop...")
    for epoch in range(1, epochs + 1):
        epoch_start = time.time()
        
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_metrics = evaluate(model, val_loader, criterion, device)
        
        scheduler.step()
        
        # Log metrics
        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_metrics["loss"])
        history["val_acc"].append(val_metrics["accuracy"])
        history["val_precision"].append(val_metrics["precision"])
        history["val_recall"].append(val_metrics["recall"])
        history["val_f1"].append(val_metrics["f1_score"])
        
        epoch_time = time.time() - epoch_start
        print(f"Epoch {epoch}/{epochs} ({epoch_time:.1f}s) - "
              f"Train Loss: {train_loss:.4f}, Train Acc: {train_acc*100:.2f}% | "
              f"Val Loss: {val_metrics['loss']:.4f}, Val Acc: {val_metrics['accuracy']*100:.2f}%, Val F1: {val_metrics['f1_score']:.4f}")
        
        # save best model - tracked by val f1 rather than val loss/accuracy since classes aren't guaranteed balanced
        val_f1 = val_metrics["f1_score"]
        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_model_path = os.path.join(args.output_dir, "kidney_ultrasound_model.pth")
            torch.save(model.state_dict(), best_model_path)
            print(f" => Saved new best model to {best_model_path}")

    total_time = time.time() - start_time
    print(f"Training completed in {total_time/60:.2f} minutes.")

    # 5. Load best model and evaluate on Test Set - re-load from disk rather than keep the in-memory
    # weights, since the last epoch isn't necessarily the best one
    best_model_path = os.path.join(args.output_dir, "kidney_ultrasound_model.pth")
    if os.path.exists(best_model_path):
        model.load_state_dict(torch.load(best_model_path))
        print("Loaded best validation weights for test evaluation.")

    test_metrics = evaluate(model, test_loader, criterion, device)
    
    # Print Test Evaluation Results
    print("\n" + "="*40)
    print("TEST EVALUATION RESULTS:")
    print(f"Test Loss:      {test_metrics['loss']:.4f}")
    print(f"Test Accuracy:  {test_metrics['accuracy']*100:.2f}%")
    print(f"Test Precision: {test_metrics['precision']:.4f}")
    print(f"Test Recall:    {test_metrics['recall']:.4f}")
    print(f"Test F1-Score:  {test_metrics['f1_score']:.4f}")
    print("="*40)
    
    # Calculate confusion matrix
    cm = confusion_matrix(test_metrics["targets"], test_metrics["predictions"])
    print("Confusion Matrix:")
    print(cm)
    
    # 6. Save Training History and Test Results
    results_path = os.path.join(args.output_dir, "training_history.json")
    results = {
        "history": history,
        "test_metrics": {
            "loss": test_metrics["loss"],
            "accuracy": test_metrics["accuracy"],
            "precision": test_metrics["precision"],
            "recall": test_metrics["recall"],
            "f1_score": test_metrics["f1_score"]
        },
        "confusion_matrix": cm.tolist()
    }
    with open(results_path, "w") as f:
        json.dump(results, f, indent=4)
    print(f"Metrics saved to {results_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Kidney Ultrasound Classifier")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--weight_decay", type=float, default=1e-2, help="Weight decay")
    parser.add_argument("--num_samples_train", type=int, default=3000, help="Synthetic train samples")
    parser.add_argument("--num_samples_val", type=int, default=500, help="Synthetic val samples")
    parser.add_argument("--num_samples_test", type=int, default=500, help="Synthetic test samples")
    parser.add_argument("--quick", action="store_true", help="Quick mode for pipeline verification")
    parser.add_argument("--output_dir", type=str, default="./outputs", help="Output directory")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    
    args = parser.parse_args()
    train_model(args)
