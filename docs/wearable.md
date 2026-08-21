# NephroCare Wearable Patch - Hardware & AI Risk Engine Architecture

## 1. Why this hardware design exists

Conventional CKD monitoring relies on periodic, invasive blood tests (creatinine) and urine tests (albumin). The NephroCare wearable patch offers a non-invasive, continuous trend monitoring approach by tracking key physiological proxies (Heart Rate, SpO2, and skin temperature) at the skin surface.

Rather than claiming lab-equivalent biomarker quantification, the hardware is scoped to what a practical 2-sensor wearable patch can deliver: **physiological trend detection and stress proxy monitoring**.

---

## 2. System Block Diagram

```
┌────────────────────────────────────────────────────────────┐
│                     WEARABLE PATCH (on-body)                │
│                                                              │
│  MAX30102 (PPG Sensor)           DS18B20 (Temperature)      │
│       │                                │                    │
│       └────────────────┬───────────────┘                    │
│                        ▼                                    │
│                 ESP32 DevKit V1                             │
│       (Sampling, serialization, JSON packaging)             │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ├─► USB Serial (Micro-USB Cable)
                         └─► Bluetooth Serial (Classic SPP)
                                 │
                                 ▼
                         ┌───────────────┐
                         │  Mobile / Web │
                         │  Client App   │
                         └───────┬───────┘
                                 │ Local HTTP API
                                 ▼
                     ┌───────────────────────┐
                     │   Python API Server   │
                     │   (AI Risk Engine)    │
                     └───────────────────────┘
```

---

## 3. Sensor Modules and Connection Map

| Sensor | ESP32 GPIO | Bus Type | ESP32 Connection Details |
|---|---|---|---|
| **MAX30102 SDA** | GPIO 21 | I2C Data | Connect to SDA pin on I2C sensor board. |
| **MAX30102 SCL** | GPIO 22 | I2C Clock | Connect to SCL pin on I2C sensor board. |
| **MAX30102 VCC** | 3.3V | Power | Power supply for optical sensor. |
| **MAX30102 GND** | GND | Ground | Common reference ground. |
| | | | |
| **DS18B20 DATA** | GPIO 4 | 1-Wire | Connect to Yellow DATA wire. **Requires 4.7kΩ pull-up resistor to VCC**. |
| **DS18B20 VCC** | 3.3V / 5V | Power | Connect to Red VCC wire. |
| **DS18B20 GND** | GND | Ground | Connect to Black GND wire. |

### Wiring Schematic Notes:
1. **MAX30102 I2C**: Connect directly to standard ESP32 I2C pins (GPIO 21 & GPIO 22). No external pull-ups are usually required if your breakout board contains them.
2. **DS18B20 1-Wire**: Connect a **4.7kΩ resistor** between the **DATA line (GPIO 4)** and the **VCC line (3.3V)**. Without this pull-up resistor, the temperature readings will default to `-127 °C` or fail to initialize.

---

## 4. Bluetooth Connection Steps

The ESP32 broadcasts a **Classic Bluetooth Serial Port Profile (SPP)** connection.

1. **Upload firmware** (code below) to your ESP32.
2. **Pair with your PC**:
   - Go to your computer's Bluetooth settings and select **Add Device**.
   - Search for and pair with the device named **`NephroCarePatch`**.
3. **Establish Connection**:
   - Once paired, your operating system assigns a virtual **COM Port** (Windows) or `/dev/rfcomm` (Linux/macOS) to the Bluetooth serial connection.
   - In the NephroCare app, click **"Connect patch"** and select either the direct USB COM port or the virtual Bluetooth COM port to start streaming telemetry data in real-time.

---

## 5. Telemetry Data Format

The sensor values are packaged into a serialized JSON string and printed once per second to both USB Serial and Bluetooth Serial:

```json
{
  "temperature": 30.5,
  "heartRate": 72,
  "spo2": 98,
  "fingerDetected": true,
  "ir": 61200
}
```

---

## 6. AI Risk Engine & Stress Index

The backend risk engine uses the real-time biometric stream to calculate the **Kidney Stress Index (0–100%)**:

* **HR/HRV Deviations**: Elevated resting heart rate serves as a cardiovascular workload indicator.
* **Skin Temperature Trends**: Extremity temperature fluctuations serve as a proxy for stress-induced vasoconstriction.
* **Biometric Fusion**:
  $$\text{Stress Index} = 0.60 \times (\text{HRV/HR Deviation}) + 0.40 \times (\text{Temp Deviation})$$

---

## 7. Bill of Materials (BOM)

| Component | Quantity | Role |
|---|---|---|
| **ESP32 DevKit V1** | 1 | Main MCU with built-in Bluetooth |
| **MAX30102 Breakout** | 1 | Heart Rate & SpO2 PPG sensor |
| **DS18B20 Probe** | 1 | Waterproof skin temperature sensor |
| **4.7kΩ Resistor** | 1 | Pull-up resistor for Dallas 1-Wire protocol |
| **Breadboard / Wires** | — | Pin-to-pin connections |
| **Micro-USB Cable** | 1 | USB power and backup serial link |

---

## 8. ESP32 Arduino Firmware Code

This is the exact code uploaded to the ESP32 patch. It is also saved in the project directory as [nephrocare_wearable.ino](file:///home/vimla/Documents/nephrocare/hardware/nephrocare_wearable.ino):

```cpp
#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"

#include <OneWire.h>
#include <DallasTemperature.h>

#include "BluetoothSerial.h"

// Bluetooth
BluetoothSerial SerialBT;

// DS18B20
#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);

// MAX30102
MAX30105 particleSensor;

// Buffers
uint32_t irBuffer[100];
uint32_t redBuffer[100];

int32_t spo2;
int8_t validSPO2;

int32_t heartRate;
int8_t validHeartRate;

// Last good values
int lastHR = 0;
int lastSpO2 = 0;

void setup()
{
  Serial.begin(115200);

  // Bluetooth Device Name
  SerialBT.begin("NephroCarePatch");

  tempSensor.begin();

  Wire.begin(21, 22);

  if (!particleSensor.begin(Wire, I2C_SPEED_FAST))
  {
    Serial.println("{\"error\":\"MAX30102 not found\"}");
    while (1);
  }

  particleSensor.setup(
    20,    // LED brightness
    4,     // sample average
    2,     // Red + IR
    100,   // sample rate
    411,   // pulse width
    4096   // ADC range
  );

  Serial.println("System Started");
  SerialBT.println("System Started");
}

void loop()
{
  // Collect 100 samples
  for (int i = 0; i < 100; i++)
  {
    while (!particleSensor.available())
      particleSensor.check();

    redBuffer[i] = particleSensor.getRed();
    irBuffer[i] = particleSensor.getIR();

    particleSensor.nextSample();
  }

  long currentIR = irBuffer[99];

  // Read Temperature
  tempSensor.requestTemperatures();
  float tempC = tempSensor.getTempCByIndex(0);

  bool fingerDetected = currentIR > 50000;

  if (fingerDetected)
  {
    maxim_heart_rate_and_oxygen_saturation(
      irBuffer,
      100,
      redBuffer,
      &spo2,
      &validSPO2,
      &heartRate,
      &validHeartRate
    );

    // Store only valid values
    if (validHeartRate && heartRate >= 40 && heartRate <= 180)
      lastHR = heartRate;

    if (validSPO2 && spo2 >= 80 && spo2 <= 100)
      lastSpO2 = spo2;
  }

  // Create JSON
  String json = "{";

  json += "\"temperature\":";
  json += String(tempC, 1);

  json += ",\"heartRate\":";
  if (lastHR > 0)
    json += String(lastHR);
  else
    json += "null";

  json += ",\"spo2\":";
  if (lastSpO2 > 0)
    json += String(lastSpO2);
  else
    json += "null";

  json += ",\"fingerDetected\":";
  json += (fingerDetected ? "true" : "false");

  json += ",\"ir\":";
  json += String(currentIR);

  json += "}";

  // USB Serial Output
  Serial.println(json);

  // Bluetooth Output
  SerialBT.println(json);

  delay(1000);
}
```
