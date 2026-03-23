'use client'

import dynamic from 'next/dynamic'

const Model3DViewer = dynamic(() => import('./Model3D'), {
    ssr: false,
    loading: () => (
        <div style={{
            height: '450px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #f0f2f5, #e8eaef)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            fontSize: '14px',
        }}>
            ⏳ Đang tải 3D Viewer...
        </div>
    ),
})

export default function Model3DWrapper(props) {
    return <Model3DViewer {...props} />
}
