'use client'

import { useEffect, useRef, useState } from 'react'

export default function Model3D({ src, caption, height = '450px', autoRotate = true }) {
    const canvasRef = useRef(null)
    const engineRef = useRef(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!canvasRef.current || !src) return

        let engine = null
        let disposed = false

        const loadScene = async () => {
            try {
                setLoading(true)
                setError(null)

                // Dynamic import Babylon.js (code-split)
                const BABYLON = await import('@babylonjs/core')
                await import('@babylonjs/loaders')

                const canvas = canvasRef.current
                if (!canvas || disposed) return

                // Create engine
                engine = new BABYLON.Engine(canvas, true, {
                    preserveDrawingBuffer: true,
                    stencil: true,
                    antialias: true,
                })
                engineRef.current = engine

                // Create scene
                const scene = new BABYLON.Scene(engine)
                scene.clearColor = new BABYLON.Color4(0.93, 0.94, 0.96, 1)

                // Load model FIRST, then set up camera
                const fileName = src.split('/').pop()
                const rootUrl = src.replace(fileName, '')

                const result = await BABYLON.SceneLoader.ImportMeshAsync(
                    '',
                    rootUrl,
                    fileName,
                    scene
                )

                if (disposed) return

                // Calculate bounding box of all meshes
                let worldMin = null
                let worldMax = null

                result.meshes.forEach((mesh) => {
                    mesh.computeWorldMatrix(true)
                    const bi = mesh.getBoundingInfo()
                    if (bi) {
                        const mMin = bi.boundingBox.minimumWorld
                        const mMax = bi.boundingBox.maximumWorld
                        if (!worldMin) {
                            worldMin = mMin.clone()
                            worldMax = mMax.clone()
                        } else {
                            worldMin.minimizeInPlace(mMin)
                            worldMax.maximizeInPlace(mMax)
                        }
                    }
                })

                // Center and size
                const center = worldMin && worldMax
                    ? BABYLON.Vector3.Center(worldMin, worldMax)
                    : BABYLON.Vector3.Zero()
                const size = worldMin && worldMax
                    ? worldMax.subtract(worldMin)
                    : new BABYLON.Vector3(2, 2, 2)
                const maxDim = Math.max(size.x, size.y, size.z) || 2

                // Camera — positioned to see the whole model
                const camera = new BABYLON.ArcRotateCamera(
                    'camera',
                    -Math.PI / 4,    // alpha
                    Math.PI / 3,     // beta
                    maxDim * 2.5,    // radius
                    center,          // target = model center
                    scene
                )
                camera.attachControl(canvas, true)
                camera.lowerRadiusLimit = maxDim * 0.3
                camera.upperRadiusLimit = maxDim * 10
                camera.wheelDeltaPercentage = 0.01
                camera.minZ = maxDim * 0.01
                camera.panningSensibility = 100

                // Auto rotate
                if (autoRotate) {
                    camera.useAutoRotationBehavior = true
                    camera.autoRotationBehavior.idleRotationSpeed = 0.2
                    camera.autoRotationBehavior.idleRotationWaitTime = 2000
                }

                // Lighting
                const hemiLight = new BABYLON.HemisphericLight(
                    'hemiLight',
                    new BABYLON.Vector3(0, 1, 0),
                    scene
                )
                hemiLight.intensity = 1.0
                hemiLight.groundColor = new BABYLON.Color3(0.5, 0.5, 0.55)

                const dirLight = new BABYLON.DirectionalLight(
                    'dirLight',
                    new BABYLON.Vector3(-0.5, -1, 0.5),
                    scene
                )
                dirLight.intensity = 0.7

                // Back light for fill
                const backLight = new BABYLON.DirectionalLight(
                    'backLight',
                    new BABYLON.Vector3(0.5, 0.3, -0.5),
                    scene
                )
                backLight.intensity = 0.3

                // Ground plane
                const ground = BABYLON.MeshBuilder.CreateGround(
                    'ground',
                    { width: maxDim * 6, height: maxDim * 6 },
                    scene
                )
                const groundMat = new BABYLON.StandardMaterial('groundMat', scene)
                groundMat.diffuseColor = new BABYLON.Color3(0.88, 0.89, 0.91)
                groundMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05)
                ground.material = groundMat
                // Position ground at model bottom
                ground.position.y = worldMin ? worldMin.y : 0

                setLoading(false)

                // Render loop
                engine.runRenderLoop(() => {
                    scene.render()
                })

                // Handle resize
                const handleResize = () => engine.resize()
                window.addEventListener('resize', handleResize)

                return () => {
                    window.removeEventListener('resize', handleResize)
                }
            } catch (err) {
                console.error('Model3D error:', err)
                setError(err.message || 'Không thể tải model 3D')
                setLoading(false)
            }
        }

        loadScene()

        return () => {
            disposed = true
            if (engine) {
                engine.dispose()
                engineRef.current = null
            }
        }
    }, [src, autoRotate])

    if (!src) {
        return (
            <div style={styles.errorBox}>
                ⚠️ Thiếu thuộc tính <code>src</code> cho Model3D
            </div>
        )
    }

    return (
        <div style={styles.container}>
            <div style={{ ...styles.canvasWrap, height }}>
                {/* Loading overlay */}
                {loading && (
                    <div style={styles.loadingOverlay}>
                        <div style={styles.spinner} />
                        <span style={styles.loadingText}>Đang tải mô hình 3D...</span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={styles.errorOverlay}>
                        <span style={{ fontSize: '32px' }}>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Canvas */}
                <canvas
                    ref={canvasRef}
                    style={{
                        ...styles.canvas,
                        opacity: loading ? 0 : 1,
                    }}
                />

                {/* Controls hint */}
                {!loading && !error && (
                    <div style={styles.hint}>
                        🖱️ Kéo để xoay • Scroll để zoom • Click phải để di chuyển
                    </div>
                )}
            </div>

            {/* Caption */}
            {caption && <div style={styles.caption}>{caption}</div>}

            <style>{`
                @keyframes spin3d {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

const styles = {
    container: {
        margin: '24px 0',
    },
    canvasWrap: {
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f0f2f5, #e8eaef)',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    },
    canvas: {
        width: '100%',
        height: '100%',
        display: 'block',
        outline: 'none',
        transition: 'opacity 0.3s',
    },
    loadingOverlay: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: 'rgba(240,242,245,0.9)',
        zIndex: 10,
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid #e2e8f0',
        borderTopColor: '#6366f1',
        borderRadius: '50%',
        animation: 'spin3d 0.8s linear infinite',
    },
    loadingText: {
        fontSize: '14px',
        color: '#64748b',
        fontWeight: '500',
    },
    errorOverlay: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        background: '#fef2f2',
        color: '#dc2626',
        fontSize: '14px',
        zIndex: 10,
    },
    hint: {
        position: 'absolute',
        bottom: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '11px',
        whiteSpace: 'nowrap',
        zIndex: 5,
        opacity: 0.7,
    },
    caption: {
        textAlign: 'center',
        fontSize: '13px',
        color: '#64748b',
        fontStyle: 'italic',
        marginTop: '8px',
    },
    errorBox: {
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#dc2626',
        padding: '16px',
        borderRadius: '8px',
        fontSize: '14px',
    },
}
