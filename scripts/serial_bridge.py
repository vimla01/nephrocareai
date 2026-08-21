#!/usr/bin/env python3
import sys
import serial
import requests
import json
import time

PORT = "/dev/ttyACM0"
BAUD = 115200
API_URL = "http://localhost:8000/api/wearable/telemetry"

print(f"Starting NephroCare Serial Bridge on {PORT} at {BAUD}...")
print(f"Streaming hardware data directly to backend: {API_URL}")

try:
    ser = serial.Serial(PORT, BAUD, timeout=1)
except Exception as e:
    print(f"Error: Could not open port {PORT}. Details: {e}")
    print("\nTroubleshooting tips:")
    print("1. Close the Arduino IDE Serial Monitor if open.")
    print("2. Run permission fix: sudo chmod 666 /dev/ttyACM0")
    print("3. Unplug the ESP32 USB cable, wait 3 seconds, and replug.")
    sys.exit(1)

buffer = ""
while True:
    try:
        if ser.in_waiting > 0:
            raw_data = ser.readline().decode('utf-8', errors='ignore')
            line = raw_data.strip()
            if not line:
                continue
            
            # Print raw line to console
            print(f"[ESP32 RAW]: {line}")
            
            # Verify if it is valid JSON
            try:
                data = json.loads(line)
                # Map payload properties to backend keys
                payload = {
                    "heart_rate": data.get("heartRate"),
                    "spo2": data.get("spo2"),
                    "skin_temp": data.get("temperature"),
                    "ir": data.get("ir")
                }
                
                # Send to backend
                response = requests.post(API_URL, json=payload, timeout=2)
                if response.status_code == 200:
                    try:
                        stress_val = response.json().get('telemetry', {}).get('current', {}).get('kidney_stress_index')
                        print(f" -> Sent to API successfully: stress_index={stress_val}%")
                    except Exception:
                        print(" -> Sent to API successfully")
                else:
                    print(f" -> Backend returned error status: {response.status_code}")
            except json.JSONDecodeError:
                # Not JSON, skip
                pass
    except KeyboardInterrupt:
        print("\nStopping serial bridge...")
        ser.close()
        break
    except Exception as e:
        print(f"Error in stream loop: {e}")
        time.sleep(1)
