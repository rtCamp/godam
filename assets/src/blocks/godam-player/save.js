/**
 * WordPress dependencies
 */
import {
	useBlockProps,
	InnerBlocks,
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
			<div className="godam-video-wrapper" style={ { position: 'relative' } }>
				<div
					className="godam-video-overlay-container"
					style={ {
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						zIndex: 100,
						pointerEvents: 'none',
					} }
				>
					<InnerBlocks.Content />
				</div>
				{ src && (
					<video
						className="easydam-player video-js vjs-big-play-centered"
						data-setup={ JSON.stringify( videoSetupOptions ) }
					>
						<Tracks tracks={ tracks } />
					</video>
				) }
			</div>
			{ caption && (
				<figcaption className="wp-element-caption rtgodam-video-caption">
					{ caption }
				</figcaption>
			) }
		</figure>
	);
}
