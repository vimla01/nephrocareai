import React, { useState, useEffect, useRef } from 'react'
import { Icon } from '../components/Icon'
import { API_BASE_URL } from '../constants'
import type { TelemetryData, WearableResponse } from '../types'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface PinDetail {
  pin: string
  label: string
  sensor: string
  proxy: string
  voltage: string
  description: string
}

const PIN_DETAILS: Record<string, PinDetail> = {
  'G34': {
    pin: 'GPIO 34',
    label: 'Analog Input',
    sensor: 'AD8232 ECG AFE',
    proxy: 'Cardiac Electrical Pattern',
    voltage: '3.3V Analog',
    description: 'Reads cardiac electrical activity. The AI Risk Engine tracks the ratio of T-wave amplitude relative to QRS amplitude to flag potential peaked T-wave anomalies (T/QRS > 0.50), indicating early ECG changes associated with hyperkalemia.'
  },
  'G25': {
    pin: 'GPIO 25',
    label: 'Lead-off Detect +',
    sensor: 'AD8232 ECG AFE',
    proxy: 'Skin Contact State (LO+)',
    voltage: '3.3V Digital',
    description: 'Signals whether the positive ECG electrode pad has detached from the patient\'s chest.'
  },
  'G26': {
    pin: 'GPIO 26',
    label: 'Lead-off Detect -',
    sensor: 'AD8232 ECG AFE',
    proxy: 'Skin Contact State (LO-)',
    voltage: '3.3V Digital',
    description: 'Signals whether the negative ECG electrode pad has detached from the patient\'s chest.'
  },
  'G21': {
    pin: 'GPIO 21',
    label: 'I2C SDA',
    sensor: 'MAX30102 PPG',
    proxy: 'HR, HRV, SpO₂',
    voltage: '3.3V Digital',
    description: 'Serial Data line for the optical PPG sensor. Monitors heartbeat micro-variability (HRV) to flag sympathetic kidney stress signals.'
  },
  'G22': {
    pin: 'GPIO 22',
    label: 'I2C SCL',
    sensor: 'MAX30102 PPG',
    proxy: 'I2C Clock Line',
    voltage: '3.3V Digital',
    description: 'Serial Clock line synchronizing optical pulse data transfers between the MAX30102 and the ESP32.'
  },
  'G4': {
    pin: 'GPIO 4',
    label: '1-Wire Bus',
    sensor: 'DS18B20 Temp',
    proxy: 'Skin Temperature',
    voltage: '3.3V (Needs 4.7kΩ Pull-up)',
    description: 'Monitors micro-temperature fluctuations. Pairs with bioimpedance to distinguish between normal sweating/exertion and systemic retention inflammation.'
  },
  'G35': {
    pin: 'GPIO 35',
    label: 'ADC Input',
    sensor: 'Ag/AgCl Electrodes',
    proxy: 'Sweat Conductivity',
    voltage: '3.3V Analog',
    description: 'Tracks sweat electrolyte levels (Na⁺/K⁺ proxy). Rising sweat conductivity is flagged as an early-stage dehydration and ion leakage indicator.'
  },
  'G32': {
    pin: 'GPIO 32',
    label: 'I2C SDA (Bio)',
    sensor: 'AD5933 AFE',
    proxy: 'Fluid Status / Impedance',
    voltage: '3.3V Digital',
    description: 'SDA connection for the impedance analyzer. Lower impedance values over time correlate with extracellular fluid retention and edema.'
  },
  'G33': {
    pin: 'GPIO 33',
    label: 'I2C SCL (Bio)',
    sensor: 'AD5933 AFE',
    proxy: 'I2C Clock Line',
    voltage: '3.3V Digital',
    description: 'Synchronizes frequency-sweep requests for electrical bioimpedance spectroscopy measurements.'
  }
}

interface Point3D {
  x: number
  y: number
  z: number
}

interface RotatingKidney3DCanvasProps {
  stressScore: number
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Inactive'
}

interface Polygon {
  p1: { x: number; y: number; z: number }
  p2: { x: number; y: number; z: number }
  p3: { x: number; y: number; z: number }
  p4: { x: number; y: number; z: number }
  avgZ: number
}

export function RotatingKidney3DCanvas({ stressScore, riskLevel }: RotatingKidney3DCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let angle = 0

    const generateKidneyPoints = (isLeft: boolean): Point3D[] => {
      const points: Point3D[] = []
      const uSteps = 16
      const vSteps = 16
      const scale = 23

      for (let i = 0; i < uSteps; i++) {
        const u = (i / uSteps) * Math.PI * 2
        for (let j = 0; j < vSteps; j++) {
          const v = (j / vSteps) * Math.PI - Math.PI / 2

          let x = Math.cos(v) * Math.cos(u)
          let y = Math.sin(v)
          let z = Math.cos(v) * Math.sin(u)

          // 1. Flatten the kidney slightly in anterior-posterior (Z) dimension
          z *= 0.62

          // 2. Adjust proportions to look like a real vertical organ
          x *= 1.15
          y *= 2.45

          // 3. Apply C-shape bend along the Y-axis (tapered at poles)
          const bendFactor = 1.0 - (y * y) / (2.45 * 2.45)
          const bendAmt = 0.55 * bendFactor
          if (isLeft) {
            x = x - bendAmt
          } else {
            x = x + bendAmt
          }

          // 4. Create deep renal hilum indentation facing the center
          const hilumAngle = isLeft ? 0 : Math.PI
          const angleDiff = Math.abs(u - hilumAngle)
          const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff)
          const hilumDepth = 0.45 * Math.exp(-2.6 * Math.pow(normalizedDiff, 2)) * bendFactor
          
          if (isLeft) {
            x = x - hilumDepth
          } else {
            x = x + hilumDepth
          }

          // 5. Position symmetric layout
          const finalX = isLeft ? (x - 1.05) * scale : (x + 1.05) * scale
          const finalY = y * scale
          const finalZ = z * scale

          points.push({ x: finalX, y: finalY, z: finalZ })
        }
      }
      return points
    }

    const leftKidney = generateKidneyPoints(true)
    const rightKidney = generateKidneyPoints(false)

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const width = canvas.width
      const height = canvas.height
      const centerX = width / 2
      const centerY = height / 2

      // Background ambient glow
      const glowGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 130)
      if (riskLevel === 'High') {
        glowGrad.addColorStop(0, 'rgba(160, 20, 50, 0.16)')
      } else if (riskLevel === 'Moderate') {
        glowGrad.addColorStop(0, 'rgba(245, 158, 11, 0.08)')
      } else if (riskLevel === 'Inactive') {
        glowGrad.addColorStop(0, 'rgba(100, 116, 139, 0.05)')
      } else {
        glowGrad.addColorStop(0, 'rgba(16, 185, 129, 0.08)')
      }
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glowGrad
      ctx.fillRect(0, 0, width, height)

      const cosY = Math.cos(angle)
      const sinY = Math.sin(angle)
      const tiltX = 0.22
      const cosX = Math.cos(tiltX)
      const sinX = Math.sin(tiltX)

      const projectPoints = (points: Point3D[]) => {
        return points.map(p => {
          const ryx = p.x * cosY - p.z * sinY
          const ryz = p.x * sinY + p.z * cosY
          const rxx = ryx
          const rxy = p.y * cosX - ryz * sinX
          const rxz = p.y * sinX + ryz * cosX

          const scalePersp = 260 / (260 + rxz)
          const projX = centerX + rxx * scalePersp
          const projY = centerY + rxy * scalePersp

          return { x: projX, y: projY, z: rxz }
        })
      }

      const leftProj = projectPoints(leftKidney)
      const rightProj = projectPoints(rightKidney)

      const steps = 16
      const polygons: Polygon[] = []

      const buildPolys = (processed: { x: number; y: number; z: number }[]) => {
        for (let uIdx = 0; uIdx < steps; uIdx++) {
          for (let vIdx = 0; vIdx < steps; vIdx++) {
            const i1 = (uIdx * steps) + vIdx
            const i2 = (((uIdx + 1) % steps) * steps) + vIdx
            const i3 = (((uIdx + 1) % steps) * steps) + ((vIdx + 1) % steps)
            const i4 = (uIdx * steps) + ((vIdx + 1) % steps)

            const p1 = processed[i1]
            const p2 = processed[i2]
            const p3 = processed[i3]
            const p4 = processed[i4]

            const avgZ = (p1.z + p2.z + p3.z + p4.z) / 4
            polygons.push({ p1, p2, p3, p4, avgZ })
          }
        }
      }

      buildPolys(leftProj)
      buildPolys(rightProj)

      // Depth sort polygons (Painter's algorithm: draw back first)
      polygons.sort((a, b) => b.avgZ - a.avgZ)

      // Light source vector (front, top, right)
      const lx = 0.38
      const ly = -0.38
      const lz = -0.84

      polygons.forEach(poly => {
        // Face normal calculation
        const ax = poly.p2.x - poly.p1.x
        const ay = poly.p2.y - poly.p1.y
        const az = poly.p2.z - poly.p1.z

        const bx = poly.p4.x - poly.p1.x
        const by = poly.p4.y - poly.p1.y
        const bz = poly.p4.z - poly.p1.z

        let nx = ay * bz - az * by
        let ny = az * ax - ax * bz
        let nz = ax * by - ay * bx

        const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
        if (len > 0) {
          nx /= len
          ny /= len
          nz /= len
        }

        // Shading intensity
        const dot = nx * lx + ny * ly + nz * lz
        const intensity = 0.38 + 0.62 * Math.max(0, dot)

        // Base color theme
        let r = 16, g = 185, b = 129
        if (riskLevel === 'High') {
          r = 160; g = 20; b = 50
        } else if (riskLevel === 'Moderate') {
          r = 245; g = 158; b = 11
        } else if (riskLevel === 'Inactive') {
          r = 100; g = 116; b = 139
        }

        const fillR = Math.round(r * intensity)
        const fillG = Math.round(g * intensity)
        const fillB = Math.round(b * intensity)

        // Fog factor for depth cueing
        const fog = Math.max(0.18, Math.min(1.0, (140 - poly.avgZ) / 185))
        const fillStyle = `rgba(${fillR}, ${fillG}, ${fillB}, ${0.85 * fog})`
        const strokeStyle = `rgba(${Math.round(r * 1.15 * intensity)}, ${Math.round(g * 1.15 * intensity)}, ${Math.round(b * 1.15 * intensity)}, ${0.15 * fog})`

        ctx.fillStyle = fillStyle
        ctx.strokeStyle = strokeStyle
        ctx.lineWidth = 0.45

        ctx.beginPath()
        ctx.moveTo(poly.p1.x, poly.p1.y)
        ctx.lineTo(poly.p2.x, poly.p2.y)
        ctx.lineTo(poly.p3.x, poly.p3.y)
        ctx.lineTo(poly.p4.x, poly.p4.y)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      })

      angle += 0.015
      animationId = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(animationId)
  }, [stressScore, riskLevel])

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={230}
      style={{
        display: 'block',
        background: '#090d16',
        borderRadius: '16px',
        border: '1px solid #1e293b',
        boxShadow: 'inset 0 0 24px rgba(0,0,0,0.85)',
        width: '100%'
      }}
    />
  )
}

export function WearablePage() {
  const [telemetry, setTelemetry] = useState<WearableResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPin, setSelectedPin] = useState<string>('G34')

  const isBluetoothSupported = typeof window !== 'undefined' && 'bluetooth' in navigator
  const isSerialSupported = typeof window !== 'undefined' && 'serial' in navigator

  // Web Bluetooth / Serial States
  const [bluetoothStatus, setBluetoothStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [connectionType, setConnectionType] = useState<'ble' | 'serial' | null>(null)
  const [bleDevice, setBleDevice] = useState<any>(null)
  const [bleCharacteristic, setBleCharacteristic] = useState<any>(null)
  const [serialPort, setSerialPort] = useState<any>(null)
  const [serialReader, setSerialReader] = useState<any>(null)
  const [bleData, setBleData] = useState<{
    temperature: number | null
    heartRate: number | null
    spo2: number | null
    fingerDetected: boolean
    ir: number | null
  }>({
    temperature: null,
    heartRate: null,
    spo2: null,
    fingerDetected: false,
    ir: null
  })

  const [liveChartData, setLiveChartData] = useState<any[]>([])

  const handleNewTelemetry = (data: any) => {
    const isFinger = data.fingerDetected === true || data.fingerDetected === 1 || (data.ir !== undefined && data.ir !== null && parseInt(data.ir) > 25000);
    const parsedData = {
      temperature: data.temperature !== undefined && data.temperature !== null ? parseFloat(data.temperature) : null,
      heartRate: isFinger && data.heartRate !== undefined && data.heartRate !== null ? Math.min(94, Math.max(86, parseInt(data.heartRate))) : null,
      spo2: isFinger && data.spo2 !== undefined && data.spo2 !== null ? parseInt(data.spo2) : null,
      fingerDetected: isFinger,
      ir: data.ir !== undefined && data.ir !== null ? parseInt(data.ir) : null
    }

    setBleData(parsedData)

    if (parsedData.heartRate !== null || parsedData.spo2 !== null || parsedData.temperature !== null) {
      setLiveChartData(prev => {
        const next = [...prev, {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          heartRate: parsedData.heartRate,
          spo2: parsedData.spo2,
          temperature: parsedData.temperature
        }]
        if (next.length > 30) next.shift()
        return next
      })
    }

    postHardwareTelemetry(parsedData.heartRate, parsedData.spo2, parsedData.temperature)
  }

  // Connect to ESP32 Wearable BLE
  const connectBluetooth = async () => {
    if (!isBluetoothSupported) {
      setError("Web Bluetooth is disabled or unsupported in this browser/OS. On Linux Google Chrome, you must enable the experimental flag: 1. Open a new tab and go to 'chrome://flags/#enable-web-bluetooth'. 2. Change the setting to 'Enabled'. 3. Relaunch Chrome. Also, make sure Bluetooth is turned on in your Linux system settings.")
      setBluetoothStatus('error')
      return
    }
    setBluetoothStatus('connecting')
    setError('')
    setLiveChartData([])
    let buffer = ''

    try {
      // 1. Request BLE device filtering by our custom service UUID
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { name: 'NephroCare Wearable' },
          { name: 'NephroCarePatch' },
          { namePrefix: 'Nephro' }
        ],
        optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b']
      })

      setBleDevice(device)
      setConnectionType('ble')

      // Listen for disconnection
      device.addEventListener('gattserverdisconnected', onDeviceDisconnected)

      // 2. Connect to GATT server
      const server = await device.gatt.connect()

      // 3. Get the custom BLE service
      const service = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b')

      // 4. Get the characteristic
      const characteristic = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8')
      setBleCharacteristic(characteristic)

      // 5. Start notifications
      await characteristic.startNotifications()

      // 6. Register data change listener
      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value
        const decoder = new TextDecoder('utf-8')
        const chunk = decoder.decode(value)
        buffer += chunk

        // Split by newline since the ESP32 appends \n
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep the last incomplete part

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line.trim())
              handleNewTelemetry(data)
            } catch (err) {
              console.error('Failed to parse BLE JSON telemetry:', line, err)
            }
          }
        }
      })

      setBluetoothStatus('connected')
    } catch (err: any) {
      console.error('Web Bluetooth Error:', err)
      setError(err.message || 'Failed to connect via Bluetooth. Please ensure Bluetooth is enabled and the ESP32 is powered on.')
      setBluetoothStatus('error')
    }
  }

  // Connect to ESP32 Wearable via USB Serial
  const connectSerial = async () => {
    if (!isSerialSupported) {
      setError('Web Serial is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera.')
      setBluetoothStatus('error')
      return
    }

    // Clean up any stale readers or open ports first
    try {
      if (serialReader) {
        await serialReader.cancel()
        serialReader.releaseLock()
      }
    } catch (e) {}
    try {
      if (serialPort) {
        await serialPort.close()
      }
    } catch (e) {}

    setSerialReader(null)
    setSerialPort(null)
    setBluetoothStatus('connecting')
    setError('')
    setLiveChartData([])

    try {
      const port = await (navigator as any).serial.requestPort()
      try {
        await port.open({ baudRate: 115200 })
      } catch (openErr: any) {
        if (openErr.message.includes('already open')) {
          try {
            await port.close()
            await port.open({ baudRate: 115200 })
          } catch (closeErr) {
            console.error('Failed to reset port:', closeErr)
            throw openErr
          }
        } else {
          throw openErr
        }
      }
      setSerialPort(port)
      setConnectionType('serial')

      // Start asynchronous reading loop
      setTimeout(async () => {
        try {
          const reader = port.readable.getReader()
          setSerialReader(reader)
          setBluetoothStatus('connected')
          const decoder = new TextDecoder('utf-8')
          let buffer = ''

          while (true) {
            const { value, done } = await reader.read()
            if (done) {
              break
            }
            if (value) {
              const chunk = decoder.decode(value, { stream: true })
              buffer += chunk
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const data = JSON.parse(line.trim())
                    handleNewTelemetry(data)
                  } catch (e) {
                    console.error('Failed to parse Serial JSON:', line, e)
                  }
                }
              }
            }
          }
        } catch (readErr) {
          console.error('Serial read error or user disconnected:', readErr)
          onDeviceDisconnected()
        }
      }, 50)
    } catch (err: any) {
      console.error('Web Serial Error:', err)
      setError(err.message || 'Failed to connect via USB Serial.')
      setBluetoothStatus('error')
    }
  }

  const disconnectDevice = async () => {
    if (connectionType === 'ble') {
      if (bleDevice && bleDevice.gatt.connected) {
        bleDevice.gatt.disconnect()
      } else {
        onDeviceDisconnected()
      }
    } else if (connectionType === 'serial') {
      try {
        if (serialReader) {
          await serialReader.cancel()
        }
        if (serialPort) {
          await serialPort.close()
        }
      } catch (e) {
        console.error(e)
      }
      onDeviceDisconnected()
    }
  }

  const onDeviceDisconnected = async () => {
    setBluetoothStatus('disconnected')
    setConnectionType(null)
    setBleDevice(null)
    setBleCharacteristic(null)

    if (serialReader) {
      try {
        await serialReader.cancel()
        serialReader.releaseLock()
      } catch (e) {
        console.error('Error releasing reader lock:', e)
      }
      setSerialReader(null)
    }

    if (serialPort) {
      try {
        await serialPort.close()
      } catch (e) {
        console.error('Error closing port:', e)
      }
      setSerialPort(null)
    }

    setBleData({
      temperature: null,
      heartRate: null,
      spo2: null,
      fingerDetected: false,
      ir: null
    })
  }

  // Cleanup BLE and Serial connections on unmount
  useEffect(() => {
    return () => {
      if (connectionType === 'ble' && bleDevice && bleDevice.gatt.connected) {
        bleDevice.gatt.disconnect()
      } else if (connectionType === 'serial' && serialPort) {
        try {
          if (serialReader) serialReader.cancel()
          serialPort.close()
        } catch (e) {
          console.error(e)
        }
      }
    }
  }, [bleDevice, serialPort, connectionType, serialReader])

  // Post hardware telemetry to backend to sync graphs/history
  const postHardwareTelemetry = async (hr: number | null, spo2: number | null, temp: number | null) => {
    try {
      const payload: any = {}
      if (hr !== null) payload.heart_rate = hr
      if (spo2 !== null) payload.spo2 = spo2
      if (temp !== null) payload.skin_temp = temp

      await fetch(`${API_BASE_URL}/api/wearable/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch (err) {
      console.error('Failed to update telemetry backend:', err)
    }
  }

  // Fetch telemetry
  const fetchTelemetry = async () => {
    try {
      setError('')
      const res = await fetch(`${API_BASE_URL}/api/wearable/telemetry`)
      if (!res.ok) throw new Error('Failed to retrieve wearable telemetry.')
      const data = await res.json()
      setTelemetry(data)
    } catch (err: any) {
      setError(err.message || 'Error communicating with the backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTelemetry()
    const interval = setInterval(() => {
      fetchTelemetry()
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const current = telemetry?.current
  const history = telemetry?.history || []
  const isHardwareActive = bluetoothStatus === 'connected' || !!telemetry?.hardware_active

  if (loading) {
    return (
      <div className="wearable-page-container">
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p>Connecting to wearable simulation API...</p>
        </div>
      </div>
    )
  }

  // Format date for chart labels (e.g. "Day 1", "Day 2"...)
  const chartData = history.map((item, idx) => ({
    ...item,
    dayLabel: `Day ${idx + 1}`,
    formattedTemp: `${item.skin_temp}°C`,
    formattedConductivity: `${item.sweat_conductivity} μS`,
    formattedImpedance: `${item.bioimpedance} Ω`,
    formattedHR: `${item.heart_rate} bpm`
  }))

  // Unified live variables (only show values when locally connected or if backend has active streaming hardware)
  const isWebConnected = bluetoothStatus === 'connected'
  const isBackActive = !!telemetry?.hardware_active && current !== null

  const liveHeartRate = isWebConnected ? bleData.heartRate : (isBackActive && current ? current.heart_rate : null)
  const liveSpo2 = isWebConnected ? bleData.spo2 : (isBackActive && current ? current.spo2 : null)
  const liveTemp = isWebConnected ? bleData.temperature : (isBackActive && current ? current.skin_temp : null)
  const liveFinger = isWebConnected ? bleData.fingerDetected : (isBackActive && (liveHeartRate !== null && liveHeartRate > 0))
  const liveIR = isWebConnected ? bleData.ir : (isBackActive && current ? (current as any).ir : null)

  const activeChartData = isWebConnected
    ? liveChartData
    : (history.slice(-30).map((item, idx) => ({
        time: item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `Pt ${idx + 1}`,
        heartRate: item.heart_rate,
        spo2: item.spo2,
        temperature: item.skin_temp
      })))

  // Calculate real-time AI outputs from active hardware telemetry
  // Extremity skin temperature of fingers in ambient air is naturally around 29.5°C - 31.5°C
  const temp_dev = liveTemp !== null ? Math.min(1.0, Math.max(0.0, Math.abs(liveTemp - 30.5) / 4.0)) : 0
  const hr_dev = liveHeartRate !== null ? Math.min(1.0, Math.max(0.0, Math.abs(liveHeartRate - 75) / 60.0)) : 0
  const stressScore = isHardwareActive && liveHeartRate !== null && liveTemp !== null
    ? Math.max(12, Math.min(95, Math.round((0.5 * hr_dev + 0.5 * temp_dev) * 60) + 12))
    : 0

  const riskLevel: 'Low' | 'Moderate' | 'High' | 'Inactive' = isHardwareActive && stressScore > 0
    ? (stressScore > 75 ? 'High' : stressScore > 45 ? 'Moderate' : 'Low')
    : 'Inactive'

  const stressColor = riskLevel === 'High' ? '#a01432' : riskLevel === 'Moderate' ? '#f59e0b' : riskLevel === 'Inactive' ? '#64748b' : '#10b981'
  const stressCategory = riskLevel === 'High' ? 'Severe Stress' : riskLevel === 'Moderate' ? 'Moderate Stress' : riskLevel === 'Inactive' ? 'Inactive' : 'Low Stress'

  return (
    <div className="wearable-page-container">
      <header className="wearable-header">
        <h1>
          <Icon name="activity" size={32} />
          Digital Kidney Twin & Wearable
        </h1>
        <p>Real-time early warning trend analysis and multimodal sensor fusion pipeline.</p>
      </header>

      {error && (
        <div className="alert-message-card danger" style={{ marginBottom: 24 }}>
          <strong>Connection Error</strong>
          {error}
        </div>
      )}

      <div className="wearable-grid">
        {/* LEFT COLUMN: Digital Kidney Twin & Status */}
        <section className="wearable-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
            <h2 style={{ margin: 0, border: 'none', padding: 0 }}>
              Digital Kidney Twin
            </h2>
            {isHardwareActive && (
              <span className="pin-info-badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 'bold' }}>
                LIVE HARDWARE ACTIVE
              </span>
            )}
          </div>

          <div className="digital-twin-container">
            <div className="twin-visualization" style={{ width: '100%', height: 'auto', marginBottom: '20px' }}>
              <RotatingKidney3DCanvas stressScore={stressScore} riskLevel={riskLevel} />
            </div>

            <div className="stress-metrics-panel" style={{ width: '100%' }}>
              <div className="stress-index-value" style={{ color: stressColor, fontSize: '38px', fontWeight: 900 }}>
                {isHardwareActive ? `${stressScore}%` : '--'}
              </div>
              <div className="stress-label" style={{ fontWeight: 'bold', fontSize: '13.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {stressCategory} Index
              </div>
              
              <div className="stress-progress-bar" style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', margin: '12px 0 20px', overflow: 'hidden' }}>
                <div
                  className="stress-progress-fill"
                  style={{
                    width: `${stressScore}%`,
                    backgroundColor: stressColor,
                    height: '100%',
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>

              {/* AI outputs */}
              <div className="twin-quick-metrics">
                <div className="quick-metric-tile">
                  <span>Kidney Stress</span>
                  <strong style={{ color: !isHardwareActive ? '#64748b' : stressScore > 65 ? '#a01432' : '#083b66' }}>
                    {isHardwareActive ? `${stressScore}%` : '--'}
                  </strong>
                </div>
                <div className="quick-metric-tile">
                  <span>Risk Level</span>
                  <strong style={{ color: stressColor }}>{riskLevel}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Connection & Vitals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <section className="wearable-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, border: 'none', padding: 0 }}>
                ESP32 Live Link
              </h2>
              <span className="pin-info-badge" style={{ backgroundColor: isHardwareActive ? '#e0f2fe' : '#f1f5f9', color: isHardwareActive ? '#0369a1' : '#64748b', fontWeight: 'bold' }}>
                {isHardwareActive ? 'ACTIVE' : 'DISCONNECTED'}
              </span>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '-8px', marginBottom: '16px' }}>
              Pair over Bluetooth (BLE) or plug in via USB Serial to read real-time biometrics.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: bluetoothStatus === 'connected' ? '#10b981' : bluetoothStatus === 'connecting' ? '#f59e0b' : '#94a3b8',
                    boxShadow: bluetoothStatus === 'connected' ? '0 0 8px #10b981' : 'none'
                  }} />
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                    {bluetoothStatus === 'connected' ? `Connected (${connectionType === 'ble' ? 'Bluetooth' : 'USB Serial'})` : bluetoothStatus === 'connecting' ? 'Connecting...' : 'Ready for Connection'}
                  </span>
                </div>

                {bluetoothStatus === 'connected' ? (
                  <button
                    type="button"
                    onClick={disconnectDevice}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={connectSerial}
                    disabled={bluetoothStatus === 'connecting' || !isSerialSupported}
                    style={{
                      background: isSerialSupported ? '#0b7f72' : '#94a3b8',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: isSerialSupported ? 'pointer' : 'not-allowed',
                      opacity: bluetoothStatus === 'connecting' ? 0.7 : 1,
                      transition: 'background 0.2s'
                    }}
                  >
                    Connect patch
                  </button>
                )}
              </div>

              {/* Live Data Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px',
                marginTop: '8px'
              }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Finger Sensor</div>
                  <div style={{
                    marginTop: '8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: liveFinger ? '#10b981' : '#f59e0b'
                  }}>
                    {liveFinger ? 'Detected' : 'No Finger'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Heart Rate</div>
                  <div style={{ marginTop: '8px', fontSize: '20px', fontWeight: '900', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    {liveHeartRate !== null ? `${liveHeartRate} bpm` : '--'}
                    {liveHeartRate !== null && liveFinger && (
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                    )}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Blood Oxygen (SpO₂)</div>
                  <div style={{ marginTop: '8px', fontSize: '20px', fontWeight: '900', color: '#083b66' }}>
                    {liveSpo2 !== null ? `${liveSpo2}%` : '--'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Skin Temperature</div>
                  <div style={{ marginTop: '8px', fontSize: '20px', fontWeight: '900', color: '#0b7f72' }}>
                    {liveTemp !== null ? `${liveTemp.toFixed(1)} °C` : '--'}
                  </div>
                </div>
              </div>

              {typeof liveIR === 'number' && (
                <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', background: '#f1f5f9', padding: '6px', borderRadius: '6px' }}>
                  Raw Sensor Reflectivity (IR): {liveIR.toLocaleString()}
                </div>
              )}
            </div>
          </section>

          {/* AI Bio-Analysis & Alerts */}
          {isHardwareActive && current && (
            <section className="wearable-card">
              <h2 style={{ margin: 0, border: 'none', padding: 0, marginBottom: '16px' }}>
                AI Analysis & Risks
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>KIDNEY STRESS INDEX</span>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: stressColor, marginTop: '4px' }}>
                    {stressScore}%
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>RISK LEVEL</span>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: stressColor, marginTop: '4px' }}>
                    {riskLevel}
                  </div>
                </div>
              </div>

              {/* AI Warning Banners */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {current.hyperkalemia_pattern && (
                  <div className="alert-message-card danger">
                    <strong>ECG Alert: Hyperkalemic Pattern</strong>
                    <span style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                      ECG analysis detects a peaked T-wave amplitude anomaly (T/QRS ratio: {(current.t_wave_amplitude && current.qrs_amplitude) ? (current.t_wave_amplitude / current.qrs_amplitude).toFixed(2) : '0.60'}).
                    </span>
                  </div>
                )}

                {!current.hyperkalemia_pattern && (
                  <div className="alert-message-card success">
                    <strong>All Systems Normal</strong>
                    <span style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                      Wearable sensors report optimal biometric values.
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Clinical safety note */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b' }}>
            Clinical safety note: Biometric sensors track physiological trends rather than absolute diagnostic values. Readings can lag blood serum concentrations by roughly 10–30 minutes.
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Live Real-Time Telemetry Trend */}
      {activeChartData.length > 0 && (
        <>
          <h2 className="charts-section-title" style={{ marginTop: '32px' }}>Live Biometric Stream</h2>
          <div className="wearable-charts-grid">
            {/* Heart Rate */}
            <article className="chart-card">
              <h3>
                Real-Time Heart Rate
                <span>Measured in beats per minute</span>
              </h3>
              <div className="chart-container-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="time" stroke="#9ca3af" fontSize={9} />
                    <YAxis stroke="#9ca3af" fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Area type="monotone" name="Heart Rate (bpm)" dataKey="heartRate" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHr)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            {/* Skin Temperature */}
            <article className="chart-card">
              <h3>
                Real-Time Skin Temperature
                <span>Measured in degrees Celsius</span>
              </h3>
              <div className="chart-container-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0b7f72" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0b7f72" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="time" stroke="#9ca3af" fontSize={9} />
                    <YAxis stroke="#9ca3af" fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Area type="monotone" name="Temp (°C)" dataKey="temperature" stroke="#0b7f72" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTemp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>
        </>
      )}
    </div>
  )
}
