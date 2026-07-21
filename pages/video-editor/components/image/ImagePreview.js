/**
 * WordPress dependencies
 */
import { useRef } from '@wordpress/element';

/**
 * Image preview shown in the editor stage for image attachments.
 *
 * This mirrors the *scaffold* role of `VideoJSPlayer` (not the self-contained
 * `AudioCardPreview` card): it renders the `<img>` inside the `#easydam-video-player`
 * container plus an empty `#easydam-layer-placeholder`. The hotspot / WooCommerce
 * layer overlays (react-rnd) are portaled into that placeholder by the selected
 * layer component via `LayerControls`, exactly as they are over the video — so the
 * hotspot placement code is reused unchanged. `computeContentRect` in those layer
 * components resolves the media element from `#easydam-video-player` and reads the
 * image's intrinsic `naturalWidth/Height`, so no aspect-ratio plumbing is needed.
 *
 * Only one preview branch mounts at a time (gated by `capability.preview`), so
 * reusing the `#easydam-video-player` id never collides with the Video.js instance.
 *
 * @param {Object} props                  Props.
 * @param {Object} props.attachmentConfig The `/wp/v2/media/:id` payload.
 * @param {Array}  props.sources          Playable sources ([{ src, type }]); `sources[0].src` is the image URL.
 * @return {JSX.Element} The image preview stage.
 */
const ImagePreview = ( { attachmentConfig, sources } ) => {
	const imgRef = useRef( null );
	const src = sources?.[ 0 ]?.src || attachmentConfig?.source_url || '';
	const alt = attachmentConfig?.title?.rendered || attachmentConfig?.alt_text || '';

	return (
		<div className="w-full image-canvas-wrapper">
			<div className="relative">
				<div
					id="easydam-video-player"
					data-test-id="godam-image-editor-element-stage"
					className="relative rounded-lg overflow-hidden godam-image-preview"
					data-test-id="godam-image-editor-preview"
					// Cap the stage container to 90% of the canvas (mirrors the video's
					// .video-canvas-wrapper): keeps a symmetric horizontal gap so the
					// image doesn't touch the stage edges, and guards against overflow —
					// a landscape image's width is driven by the 500px height cap (e.g.
					// 1280x719 -> 890px), which would otherwise grow this content-sized
					// container past the stage. The image's max-width:100% resolves
					// against this cap, so it shrinks to fit and stays responsive.
					style={ { maxWidth: '95%' } }
				>
					<img
						ref={ imgRef }
						src={ src }
						alt={ alt }
						data-test-id="godam-image-editor-element-preview-img"
						className="godam-image-preview__img"
						// Once the intrinsic size is known, nudge the layer components'
						// `computeContentRect` (bound to `resize`) to recompute the box.
						onLoad={ () => window.dispatchEvent( new Event( 'resize' ) ) }
						// Responsive: shrink to fit the stage width AND the 500px height
						// cap while preserving aspect ratio, and never upscale (`width`/
						// `height: auto`, not `100%`). The rendered box then equals the
						// image, so the hotspot overlay (computeContentRect) stays aligned.
						style={ { display: 'block', width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '500px', margin: '0 auto' } }
					/>
					<div id="easydam-layer-placeholder" data-test-id="godam-image-editor-element-layer-placeholder" />
				</div>
			</div>
		</div>
	);
};

export default ImagePreview;
