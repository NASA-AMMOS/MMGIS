import React, { useEffect, useRef } from "react";
import { makeStyles } from "@mui/styles";
import { publicUrlMainSite } from "../../core/constants";
import { isUrlAbsolute } from "../../core/utils";

const useStyles = makeStyles((theme) => ({
  VideoPreview: {
    width: "100%",
    height: "100%",
    background: theme.palette.swatches.grey[100],
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${theme.palette.swatches.grey[300]}`,
    borderRadius: "4px",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    background: "#000",
  },
  placeholder: {
    color: theme.palette.swatches.grey[400],
    fontSize: "14px",
    textAlign: "center",
    padding: "20px",
  },
  error: {
    color: theme.palette.swatches.red[400],
    fontSize: "14px",
    textAlign: "center",
    padding: "20px",
  },
}));

const VideoPreview = ({ layer, configuration }) => {
  const videoRef = useRef(null);
  const c = useStyles();

  // Handle relative URLs by prepending the public URL and mission path
  const getFullVideoUrl = (url) => {
    if (!url) return null;

    if (isUrlAbsolute(url)) {
      return url;
    }

    // For relative URLs, prepend publicUrlMainSite and mission path
    const missionPath = `Missions/${configuration?.msv?.mission || ""}`;
    return `${publicUrlMainSite}/${missionPath}/${url}`;
  };

  const fullVideoUrl = getFullVideoUrl(layer?.url);

  useEffect(() => {
    if (videoRef.current && fullVideoUrl) {
      // Reset video when URL changes
      videoRef.current.load();
    }
  }, [fullVideoUrl]);

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      // Ensure video is muted and paused for preview
      videoRef.current.muted = true;
      videoRef.current.pause();
    }
  };

  if (!fullVideoUrl) {
    return (
      <div className={c.VideoPreview}>
        <div className={c.placeholder}>Enter a video URL to see preview</div>
      </div>
    );
  }

  return (
    <div className={c.VideoPreview}>
      <video
        ref={videoRef}
        className={c.video}
        src={fullVideoUrl}
        muted
        onLoadedData={handleVideoLoaded}
        controls={true}
      >
        <div className={c.error}>
          Video format not supported or failed to load
        </div>
      </video>
    </div>
  );
};

export default VideoPreview;
