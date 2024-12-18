/**
 * WordPress dependencies
 */
import {
	RichText,
	useBlockProps,
	__experimentalGetElementClassName,
} from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import Tracks from './tracks';

export default function save( { attributes } ) {
	const {
		autoplay,
		caption,
		controls,
		loop,
		muted,
		poster,
		preload,
		src,
		sources,
		playsInline,
		tracks,
	} = attributes;

    const videoSetupOptions = {
        controls,
        autoplay,
		loop,
		muted,
        preload,
		poster,
        fluid: true,
		sources,
    };
	
	return (
		<figure { ...useBlockProps.save() }>
			{ src && (
                <video
					className="easydam-player video-js vjs-big-play-centered"
					data-setup={ JSON.stringify( videoSetupOptions ) }
				>
					<Tracks tracks={ tracks } />
				</video>
			) }
		</figure>
	);
}
