/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	Disabled,
	PanelBody,
	ToggleControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControl as ToggleGroupControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { useMemo, useCallback } from '@wordpress/element';

/**
 * Playback-specific toggles: Autoplay, Loop, Muted, Playback controls, Share Button.
 *
 * @param {Object}   props               Component props.
 * @param {Function} props.setAttributes Function to set block attributes.
 * @param {Object}   props.attributes    Block attributes.
 */
export const PlaybackControls = ( { setAttributes, attributes } ) => {
	const { autoplay, controls, loop, muted, showShareButton, showSubtitles, tracks, id, cmmId } = attributes;
	const showShareButtonSetting = window?.godamSettings?.enableGlobalVideoShare ?? false;
	const videoEditorUrl = `${ window?.pluginInfo?.adminUrl || '/wp-admin/' }admin.php?page=rtgodam_video_editor&id=${ id || cmmId }&tab=transcription`;
	const hasNoTracks = ! tracks || tracks.length === 0;

	const getAutoplayHelp = useMemo( () => {
		if ( autoplay && muted ) {
			return __( 'Autoplay may cause usability issues for some users.', 'godam' );
		}
		return null;
	}, [ autoplay, muted ] );

	const getMutedHelp = useMemo( () => {
		if ( autoplay && muted ) {
			return __( 'Muted because of Autoplay.', 'godam' );
		}
		return null;
	}, [ autoplay, muted ] );

	const toggleFactory = useMemo( () => {
		const toggleAttribute = ( attribute ) => ( newValue ) => {
			setAttributes( { [ attribute ]: newValue } );
		};
		return {
			autoplay: toggleAttribute( 'autoplay' ),
			loop: toggleAttribute( 'loop' ),
			muted: toggleAttribute( 'muted' ),
			controls: toggleAttribute( 'controls' ),
			showShareButton: toggleAttribute( 'showShareButton' ),
			showSubtitles: toggleAttribute( 'showSubtitles' ),
		};
	}, [ setAttributes ] );

	return (
		<div className="godam-playback-controls">
			<div data-test-id="godam-video-control-autoplay">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Autoplay', 'godam' ) }
					onChange={ ( e ) => {
						toggleFactory.muted( e );
						toggleFactory.autoplay( e );
					} }
					checked={ !! autoplay }
					help={ getAutoplayHelp }
				/>
			</div>
			<div data-test-id="godam-video-control-loop">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Play on loop', 'godam' ) }
					onChange={ toggleFactory.loop }
					checked={ !! loop }
				/>
			</div>
			<div data-test-id="godam-video-control-muted">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Muted', 'godam' ) }
					onChange={ toggleFactory.muted }
					disabled={ autoplay }
					checked={ !! muted }
					help={ getMutedHelp }
				/>
			</div>
			<div data-test-id="godam-video-control-controls">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Playback controls', 'godam' ) }
					onChange={ toggleFactory.controls }
					checked={ !! controls }
				/>
			</div>
			{ showShareButtonSetting && (
				<div data-test-id="godam-video-control-show-share-button">
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show share button', 'godam' ) }
						onChange={ toggleFactory.showShareButton }
						checked={ !! showShareButton }
						help={ __( 'Adds a share button on the video player for transcoded videos', 'godam' ) }
					/>
				</div>
			) }
			{ /* TODO: Add "Show transcription" toggle control here when it is ready. */ }
			<div data-test-id="godam-video-control-show-subtitles">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Show subtitles', 'godam' ) }
					onChange={ toggleFactory.showSubtitles }
					checked={ !! showSubtitles }
				/>
			</div>
			{ showSubtitles && hasNoTracks && ( id || cmmId ) && (
				<div className="godam-subtitle-notice notice notice-warning" data-test-id="godam-video-element-subtitle-notice">
					<p>
						{ __( 'No subtitle file uploaded.', 'godam' ) }
						{ ' ' }
						<a href={ videoEditorUrl } target="_blank" rel="noopener noreferrer">
							{ __( 'Click here to upload subtitles.', 'godam' ) }
						</a>
					</p>
				</div>
			) }
		</div>
	);
};

const performanceHelpText = {
	balanced: __( 'Recommended for most videos. Loads thumbnails as visitors scroll and prepares the video just before they reach it. Best for overall page performance.', 'godam' ),
	priority: __( 'For hero videos above the fold. Loads the thumbnail immediately and prepares the video for the fastest possible first play. Use sparingly - one or two per page.', 'godam' ),
};

const resolveLegacyPerformanceMode = ( preload, preloadPoster ) => {
	const normalizedPreload = typeof preload === 'string' ? preload.toLowerCase() : '';

	if ( preloadPoster ) {
		return 'priority';
	}

	if ( normalizedPreload === 'preload only video thumbnail' ) {
		return 'priority';
	}

	return 'balanced';
};

export const PerformanceControl = ( { setAttributes, attributes } ) => {
	const { preload, preloadPoster, performanceMode } = attributes;

	const selectedPerformanceMode = useMemo(
		() => performanceMode || resolveLegacyPerformanceMode( preload, preloadPoster ),
		[ performanceMode, preload, preloadPoster ],
	);

	const onChangePerformanceMode = useCallback( ( value ) => {
		setAttributes( {
			performanceMode: value,
			preload: value === 'priority' ? 'metadata' : 'none',
			preloadPoster: false,
		} );
	}, [ setAttributes ] );

	return (
		<ToggleGroupControl
			__nextHasNoMarginBottom
			isBlock
			data-test-id="godam-video-control-performance"
			value={ selectedPerformanceMode }
			onChange={ onChangePerformanceMode }
			help={ performanceHelpText[ selectedPerformanceMode ] }
		>
			<ToggleGroupControlOption value="priority" label={ __( 'Priority', 'godam' ) } />
			<ToggleGroupControlOption value="balanced" label={ __( 'Balanced', 'godam' ) } />
		</ToggleGroupControl>
	);
};

export const LikesAndComments = ( { setAttributes, attributes, isInsideQueryLoop = false } ) => {
	const { engagements } = attributes;
	const engagementFeatureEnabled = window?.godamSettings?.engagementFeatureEnabled ?? false;
	const showEngagementSetting = engagementFeatureEnabled && ( window?.godamSettings?.enableGlobalVideoEngagement ?? false );

	const toggleEngagements = useMemo( () => ( newValue ) => {
		setAttributes( { engagements: newValue } );
	}, [ setAttributes ] );

	if ( isInsideQueryLoop || ! showEngagementSetting ) {
		return null;
	}

	const toggleControl = (
		<div data-test-id="godam-video-control-engagements">
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Enable Likes & Comments', 'godam' ) }
				onChange={ toggleEngagements }
				checked={ !! engagements }
				help={ __( 'Engagement will only be visible for transcoded videos', 'godam' ) }
			/>
		</div>
	);

	return (
		<PanelBody title={ __( 'Likes & Comments', 'godam' ) } data-test-id="godam-video-panel-likes-comments">
			{ window.pluginInfo?.validApiKey
				? toggleControl
				: <div className="godam-components-disabled"><Disabled>{ toggleControl }</Disabled></div>
			}
		</PanelBody>
	);
};
