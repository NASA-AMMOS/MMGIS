import React from 'react'
import F_ from '../../Formulae_/Formulae_'

function Toolbar() {
    return (
        <>
            <div
                id="toolbar"
                style={{
                    width: '40px',
                    paddingTop: '40px',
                    background: 'var(--color-a)',
                    borderRight: '1px solid var(--color-a-5)',
                    top: '0px',
                    height: '100%',
                    zIndex: 1004,
                }}
            ></div>
            <div
                id="mmgislogo"
                style={{
                    display: 'none',
                    padding: '9px 6px',
                    cursor: 'pointer',
                    width: '40px',
                    height: '40px',
                    position: 'absolute',
                    top: '0px',
                    left: '0px',
                    zIndex: 2005,
                    imageRendering: 'pixelated',
                }}
                onClick={F_.toHostForceLanding}
                dangerouslySetInnerHTML={{
                    __html: `<svg width="27" height="27" viewBox="0 0 231 137" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0.222266 9.21339C-0.277832 14.7126 0.222266 133.713 0.222266 133.713H26.2223V45.7134C26.2223 45.7134 100.722 127.712 106.222 132.713C109.171 135.395 112.12 136.782 115.222 136.645C118.325 136.782 121.274 135.395 124.222 132.713C129.722 127.712 204.222 45.7134 204.222 45.7134V133.713H230.222C230.222 133.713 230.722 14.7126 230.222 9.21339C229.722 3.71413 218.222 -3.28766 210.222 1.71339C202.222 6.71444 115.222 104.713 115.222 104.713C115.222 104.713 28.2224 6.71444 20.2223 1.71339C12.2222 -3.28766 0.722363 3.71413 0.222266 9.21339Z" fill="#08AEEA"></path>
</svg>`,
                }}
            ></div>
            <div
                id="dataLoadingSpinner"
                style={{
                    opacity: 0,
                    transition: 'opacity 0.3s ease-in-out',
                    pointerEvents: 'none',
                    width: '40px',
                    height: '40px',
                    background: 'var(--color-a)',
                    position: 'absolute',
                    top: '0px',
                    left: '0px',
                    zIndex: 2005,
                }}
            >
                <div
                    className="mmgis-spinner2"
                    style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                    }}
                ></div>
            </div>
        </>
    )
}

export default Toolbar
