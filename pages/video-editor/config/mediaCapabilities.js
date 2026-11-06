/**
 * Media-type capability registry for the editor shell.
 *
 * The editor was originally video-only: the tab list, preview component, copy
 * block name, preview page, allowed layer types and stats row were all
 * hard-wired to "video". This registry turns those assumptions into data keyed
 * by media type so the same shell can drive video, audio and (in future) image
 * editing. The `video` descriptor reproduces the historic behaviour exactly, so
 * routing video through it is a no-op.
 *
 * Descriptor fields:
 * `mediaType` — 'video' | 'audio' | 'image'.
 * `tabs` — ordered left-rail tab names; also the allow-list validating `setCurrentTab`.
 * `defaultTab` — tab selected when the editor opens for this media type.
 * `preview` — discriminator the editor maps to a preview component (`'videojs'` → VideoJSPlayer, `'audio'` → AudioCardPreview, `'image'` → ImagePreview). Components are not stored here to keep this module free of React/store imports.
 * `copyBlockName` — Gutenberg block emitted by the Copy action.
 * `previewPage` — `godam_page` query value for the front-end Preview link.
 * `showPreview` — whether the top-bar Preview button renders.
 * `showTimeline` — whether the timeline dock is available.
 * `showStats` — whether the analytics stats row / Analytics menu render.
 * `showCopy` — whether the top-bar Copy-block button renders (defaults to `true` when absent).
 */

export const MEDIA_TYPES = {
	VIDEO: 'video',
	AUDIO: 'audio',
	IMAGE: 'image',
};

/**
 * The set of tab names the shell knows how to render. A capability's `tabs`
 * must be a subset of these.
 */
export const KNOWN_TABS = [ 'layers', 'player-settings', 'transcription', 'chapters' ];

const CAPABILITIES = {
	video: {
		mediaType: 'video',
		tabs: [ 'layers', 'player-settings', 'transcription', 'chapters' ],
		defaultTab: 'layers',
		preview: 'videojs',
		copyBlockName: 'godam/video',
		previewPage: 'video-preview',
		showPreview: true,
		showTimeline: true,
		showStats: true,
	},
	audio: {
		mediaType: 'audio',
		tabs: [ 'transcription', 'chapters' ],
		defaultTab: 'transcription',
		preview: 'audio',
		copyBlockName: 'godam/audio',
		// Audio reuses the shared front-end preview page (`godam_page=video-preview`),
		// which renders the `[godam_audio]` shortcode (custom player + Chapters /
		// Transcript panel) and adapts its labels for audio. See
		// godam_preview_page_content() and inc/templates/video-preview.php.
		previewPage: 'video-preview',
		showPreview: true,
		showTimeline: false,
		showStats: false,
	},
	// Image editor — layers placed spatially on a static image. Which layer
	// types it offers comes from each type's `supports.media` (Hotspot, and the
	// WooCommerce product hotspot). Copy and Preview are enabled: the
	// `godam/image` front-end block exists (Iteration 2).
	image: {
		mediaType: 'image',
		tabs: [ 'layers' ],
		defaultTab: 'layers',
		preview: 'image',
		copyBlockName: 'godam/image',
		// Images reuse the shared front-end preview page (`godam_page=video-preview`),
		// which renders the `godam/image` block and adapts its labels for images.
		// See godam_preview_page_content() and inc/templates/video-preview.php.
		previewPage: 'video-preview',
		showPreview: true,
		showTimeline: false,
		showStats: false,
	},
};

/**
 * Resolve a media type from an attachment MIME type. Defaults to `'video'`
 * (the historic behaviour) for anything unrecognised.
 *
 * @param {string} mimeType Attachment MIME type, e.g. `audio/mpeg`.
 * @return {string} `'video' | 'audio' | 'image'`.
 */
export function getMediaTypeFromMime( mimeType = '' ) {
	if ( typeof mimeType === 'string' ) {
		if ( mimeType.startsWith( 'audio/' ) ) {
			return MEDIA_TYPES.AUDIO;
		}
		if ( mimeType.startsWith( 'image/' ) ) {
			return MEDIA_TYPES.IMAGE;
		}
	}
	return MEDIA_TYPES.VIDEO;
}

/**
 * Get the capability descriptor for a media type. Unknown types fall back to
 * the video descriptor.
 *
 * @param {string} mediaType `'video' | 'audio' | 'image'`.
 * @return {Object} The capability descriptor.
 */
export function getCapability( mediaType ) {
	return CAPABILITIES[ mediaType ] || CAPABILITIES.video;
}

/**
 * Convenience: resolve the capability directly from a MIME type.
 *
 * @param {string} mimeType Attachment MIME type.
 * @return {Object} The capability descriptor.
 */
export function getCapabilityForMime( mimeType ) {
	return getCapability( getMediaTypeFromMime( mimeType ) );
}
