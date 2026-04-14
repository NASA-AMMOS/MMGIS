import React, { useEffect, useRef } from 'react'

function TopBar() {
    const topBarLeftRef = useRef(null)

    useEffect(() => {
        const el = topBarLeftRef.current
        if (el) {
            const handleWheel = (e) => {
                e.preventDefault()
                el.scrollLeft += e.deltaY
            }
            el.addEventListener('wheel', handleWheel, { passive: false })
            return () => el.removeEventListener('wheel', handleWheel)
        }
    }, [])

    return (
        <div id="topBar">
            <div id="topBarLeft" className="hideScrollbar" ref={topBarLeftRef}>
                <div id="topBarMain">
                    <div id="topBarTitle">
                        <div id="topBarTitleName" tabIndex={200}>
                            {window.mmgisglobal.name}
                        </div>
                    </div>
                </div>
                <div id="topBarSecondary">
                    <div
                        className="mainDescription"
                        title="Go to active item"
                    ></div>
                    <div
                        className="mainInfo"
                        title="Go to featured item"
                    ></div>
                </div>
            </div>
            <div id="topBarRight">
                <div className="Search"></div>
            </div>
        </div>
    )
}

export default TopBar
