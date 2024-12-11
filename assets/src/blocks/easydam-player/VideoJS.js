import React from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-contrib-quality-menu';

import { useRef, useEffect } from '@wordpress/element';

export const VideoJS = (props) => {
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const { options, onReady } = props;
    
    useEffect(() => {
        // Make sure Video.js player is only initialized once
        if (!playerRef.current) {
            // The Video.js player needs to be _inside_ the component el for React 18 Strict Mode.
            const videoElement = document.createElement("video-js");

            videoElement.classList.add("vjs-big-play-centered");
            videoElement.classList.add("vjs-styles-dimensions");
            videoRef.current.appendChild(videoElement);

            const player = (playerRef.current = videojs(videoElement, options), () => {
                onReady && onReady(player);
            });

            // Add quality menu
            playerRef.current.qualityMenu();

        // You could update an existing player in the `else` block here
        // on prop change, for example:
        } else {
            const player = playerRef.current;

            player.autoplay(options.autoplay);
            player.poster(options.poster || '');
            player.controls(options.controls);
            player.loop(options.loop);
            player.muted(options.muted);
            player.preload(options.preload || '');
            player.playsinline(options.playsinline);
            player.src(options.sources);
        }
    }, [options, videoRef]);

    // Dispose the Video.js player when the functional component unmounts
    useEffect(() => {
        const player = playerRef.current;

        if ( playerRef.current ) {

            const playerEl = playerRef.current.el_;
            let video = playerEl.querySelector('video');

            video.addEventListener("loadedmetadata", () => {
                playerEl.style.paddingTop = `${(video.videoHeight / video.videoWidth) * 100}%`;
            });
        }

        return () => {
            if (player && !player.isDisposed()) {
                player.dispose();
                playerRef.current = null;
            }
        };
    }, [playerRef]);

    return (
        <div data-vjs-player>
            <div ref={videoRef} />
        </div>
    );
};

export default VideoJS;
