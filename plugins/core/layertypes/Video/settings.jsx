import React, { useEffect, useState } from 'react'
import { Button, Slider } from '@design/components'
import L_ from '@basics/Layers_/Layers_'
import './settings.css'

function VideoSettings({ layer }) {
    const [playing, setPlaying] = useState(false)
    const [muted, setMuted] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const video = L_.layers.layer[layer.name]?.getElement?.()
    useEffect(() => {
        if (!video) return
        const update = () => {
            setCurrentTime(video.currentTime || 0)
            setDuration(video.duration || 0)
            setMuted(video.muted)
            setPlaying(!video.paused)
        }
        video.addEventListener('timeupdate', update)
        video.addEventListener('loadedmetadata', update)
        video.addEventListener('volumechange', update)
        video.addEventListener('play', update)
        video.addEventListener('pause', update)
        update()
        return () => {
            video.removeEventListener('timeupdate', update)
            video.removeEventListener('loadedmetadata', update)
            video.removeEventListener('volumechange', update)
            video.removeEventListener('play', update)
            video.removeEventListener('pause', update)
        }
    }, [video])
    if (!video) return <div>Turn on the video layer to load playback controls.</div>
    const download = layer.variables?.downloadURL || L_.getUrl(layer.type, layer.url, layer)
    return (
        <div className="lt2-videoSettings">
            <div className="lt2-videoControls">
                <Button
                    size="sm"
                    variant="secondary"
                    aria-label={playing ? 'Pause video' : 'Play video'}
                    onClick={() => {
                        if (video.paused) video.play().catch(() => {})
                        else video.pause()
                    }}
                >
                    <i className={`mdi mdi-${playing ? 'pause' : 'play'} mdi-16px`} />
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    aria-label="Restart video"
                    onClick={() => {
                        video.currentTime = 0
                        video.play().catch(() => {})
                    }}
                >
                    <i className="mdi mdi-restart mdi-16px" />
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    aria-label={muted ? 'Unmute video' : 'Mute video'}
                    onClick={() => {
                        video.muted = !video.muted
                        setMuted(video.muted)
                    }}
                >
                    <i className={`mdi mdi-volume-${muted ? 'off' : 'high'} mdi-16px`} />
                </Button>
            </div>
            <div className="lt2-videoScrub">
                <span>{Math.floor(currentTime)}s</span>
                <Slider
                    min={0}
                    max={Math.max(1, duration)}
                    step={0.1}
                    value={currentTime}
                    onValueChange={(value) => {
                        video.currentTime = Array.isArray(value) ? value[0] : value
                        setCurrentTime(video.currentTime)
                    }}
                />
                <span>{Math.floor(duration)}s</span>
            </div>
            {download && (
                <a href={download} target="_blank" rel="noreferrer">
                    Download video
                </a>
            )}
        </div>
    )
}

export default {
    sections: () => [
        {
            id: 'video-controls',
            label: 'Playback',
            order: 10,
            Component: VideoSettings,
        },
    ],
    actions: () => [],
    status: (layer) =>
        layer.error
            ? { kind: 'failed', message: layer.error.message || 'Video failed to load' }
            : null,
}
