/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';
import videojs from 'video.js';

/**
 * WordPress dependencies
 */
import { Button, Notice, ComboboxControl, Icon, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { closeSmall, error } from '@wordpress/icons';
import { useState, useRef, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { scrollToTop } from '../../../utils/index.js';
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting, resetChangeFlag } from '../../../redux/slice/media-settings.js';
import BrandImageSelector from '../GeneralSettings/BrandImageSelector.jsx';
import SettingsButton from '../../../../../assets/src/js/godam-player/masterSettings.js';
import ColorPickerButton from '../../../../video-editor/components/shared/color-picker/ColorPickerButton.jsx';
import Share from '../../../../../assets/src/images/share.svg';
import ShareVariationOne from '../../../../../assets/src/images/share-variation-one.svg';
import CustomVideoPlayerCSS from './CustomVideoPlayerCSS.jsx';

const VideoPlayer = () => {
	const dispatch = useDispatch();
	const wrapperRef = useRef( null );

	// Selectors to get media settings and change flag
	const { mediaSettings, isChanged } = useSelector( ( state ) => ( {
		mediaSettings: state.mediaSettings,
		isChanged: state.mediaSettings.isChanged,
	} ) );

	const [ saveMediaSettings, { isLoading: saveMediaSettingsLoading } ] = useSaveMediaSettingsMutation();
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	// Function to show a notice message
	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	};

	// Function to handle setting changes
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'video_player', key, value } ) );

		if ( key !== 'custom_css' ) {
			return; // Only handle custom_css
		}

		let styleElement = document.querySelector( '#godam-custom-css-inline-style' );

		// If value is empty, clean up any existing style element
		if ( ! value ) {
			if ( styleElement ) {
				styleElement.remove(); // or: styleElement.textContent = '';
			}
			return;
		}

		// Replace .godam-video-container → .video-player-settings-preview
		const scopedValue = value.replaceAll(
			'.godam-video-container',
			'.video-player-settings-preview',
		);

		// Create it only if it doesn't exist
		if ( ! styleElement ) {
			styleElement = document.createElement( 'style' );
			styleElement.id = 'godam-custom-css-inline-style';
			document.head.appendChild( styleElement );
		}

		// Update the style content
		styleElement.textContent = scopedValue;
	};

	// Function to handle saving settings
	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( { settings: mediaSettings } ).unwrap();

			if ( response?.status === 'success' ) {
				showNotice( __( 'Settings saved successfully.', 'godam' ) );
				dispatch( resetChangeFlag() );
			} else {
				showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
			}
		} catch ( err ) {
			showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
		}
	};

	useEffect( () => {
		if ( ! wrapperRef.current ) {
			return;
		}

		const videoElement = document.createElement( 'video-js' );
		videoElement.classList.add( 'video-js', 'vjs-big-play-centered' );

		wrapperRef.current.appendChild( videoElement );

		const primarySource = {
			src: 'https://n8e0ka87m9.gdcdn.us/vo15od683f/output.mpd',
			type: 'application/dash+xml',
		};

		const fallbackSource = {
			src: 'https://n8e0ka87m9.gdcdn.us/vo15od683f/rtcamp-video-1-orignal.mp4',
			type: 'video/mp4',
		};

		const playerSkin = mediaSettings?.video_player?.player_skin || 'Default';

		// apply styles on initial render if user has added css before
		if ( mediaSettings?.video_player?.custom_css ) {
			let styleElement = document.querySelector(
				'#godam-custom-css-inline-style',
			);

			// Update CSS selectors so styles meant for the frontend video (.godam-video-container)
			// are applied to the actual video player preview container (.video-player-settings-preview)
			const scopedValue = mediaSettings?.video_player?.custom_css.replaceAll(
				'.godam-video-container',
				'.video-player-settings-preview',
			);

			// Create it only if it doesn't exist
			if ( ! styleElement ) {
				styleElement = document.createElement( 'style' );
				styleElement.id = 'godam-custom-css-inline-style';
				document.head.appendChild( styleElement ); // or your container
			}

			// Update the style content
			styleElement.textContent = scopedValue;
		}

		// Initialize Video.js player
		const player = videojs( videoElement, {
			controls: true,
			autoplay: false,
			preload: 'auto',
			aspectRatio: '16:9',
			fluid: false,
			sources: [ primarySource ],
			controlBar: {
				playToggle: true,
				volumePanel: {
					inline: ! ( playerSkin === 'Minimal' || playerSkin === 'Pills' ),
				},
				currentTimeDisplay: true,
				timeDivider: true,
				durationDisplay: true,
				fullscreenToggle: true,
				subsCapsButton: true,
				remainingTimeDisplay: playerSkin === 'Default' ? true : false,
				pictureInPictureToggle: true,
				skipButtons: {
					forward: 10,
					backward: 10,
				},
			},
			// VHS (HLS/DASH) initial configuration to prefer a ~14 Mbps start.
			// This only affects the initial bandwidth guess; VHS will continue to measure actual throughput and adapt.
			html5: {
				vhs: {
					bandwidth: 14_000_000, // Pretend network can do ~14 Mbps at startup
					bandwidthVariance: 1.0, // allow renditions close to estimate
					limitRenditionByPlayerDimensions: false, // don't cap by video element size
				},
			},
		}, () => {
			// Register the unified settings button component
			const controlBar = player.getChild( 'controlBar' );
			if ( ! controlBar.getChild( 'SettingsButton' ) ) {
				if ( ! videojs.getComponent( 'SettingsButton' ) ) {
					videojs.registerComponent( 'SettingsButton', SettingsButton );
				}
				controlBar.addChild( 'SettingsButton', {} );
			}
			const settingsEl = document.querySelector( '.vjs-settings-button' );
			if ( settingsEl ) {
				settingsEl.querySelector( '.vjs-icon-placeholder' ).classList.add( 'vjs-icon-cog' );
			}

			// Share button
			const ButtonBase = videojs.getComponent( 'Button' );

			const ShareButtonImg = () => {
				switch ( mediaSettings?.video_player?.player_skin ) {
					case 'Minimal':
						return ShareVariationOne;
					case 'Pills':
						return ShareVariationOne;
					case 'Bubble':
						return ShareVariationOne;
					default:
						return Share;
				}
			};
			class GodamShareButton extends ButtonBase {
				buildCSSClass() {
					return `godam-share-button ${ super.buildCSSClass() }`;
				}

				// Set the button content
				createEl() {
					const el = super.createEl( 'button', {
						className: 'vjs-button godam-share-button',
						title: 'Disabled in preview mode', // native tooltip
						disabled: true, // disables the button
					} );

					const img = document.createElement( 'img' );
					img.src = ShareButtonImg();
					img.alt = 'Share';
					img.className = 'share-icon';

					el.appendChild( img );
					return el;
				}
				// Add click event for playback
				handleClick( event ) {
					event.preventDefault();
				}
			}

			const playerWrapper = player.el();

			if ( ! videojs.getComponent( 'GodamShareButton' ) ) {
				videojs.registerComponent( 'GodamShareButton', GodamShareButton );
			}

			const shareButton = new GodamShareButton( player );
			if ( playerSkin === 'Bubble' ) {
				controlBar.addChild( 'GodamShareButton', {} );
			} else {
				playerWrapper.appendChild( shareButton.el() );
			}
		} );

		player.ready( () => {
			player.addRemoteTextTrack(
				{
					kind: 'subtitles',
					label: 'Preview',
					language: 'en',
					src: '', // Empty src – it's just for UI purposes
					default: false,
				},
				false,
			);
		} );

		// Fallback handling
		player.on( 'error', () => {
			// Only try fallback once (you can also track a retry flag if needed)
			if ( player.currentSrc() === primarySource.src ) {
				player.src( fallbackSource );
				player.load();
				player.play();
			}
		} );

		return () => {
			if ( player && ! player.isDisposed() ) {
				player.dispose();
			}
		};
	}, [ mediaSettings?.video_player?.player_skin ] );

	useEffect( () => {
		const videoElement = wrapperRef.current?.querySelector( 'video-js' );
		const player = videojs.getPlayer( videoElement.id );

		if ( ! player ) {
			return;
		}

		// Set custom brand color as CSS variable
		const userSelectedStyles = {
			'--rtgodam-control-bar-color': mediaSettings?.video_player?.brand_color,
		};

		Object.entries( userSelectedStyles ).forEach( ( [ key, val ] ) => {
			videoElement.style.setProperty( key, val );
		} );

		// Handle custom brand image button
		const controlBar = player.getChild( 'controlBar' );
		const brandImage = mediaSettings?.video_player?.brand_image?.trim();

		if ( brandImage ) {
			if ( ! controlBar.getChild( 'CustomButton' ) ) {
				const CustomPlayButton = videojs.getComponent( 'Button' );

				class CustomButton extends CustomPlayButton {
					createEl() {
						const el = super.createEl();
						el.className += ' vjs-custom-play-button';
						const img = document.createElement( 'img' );
						img.src = brandImage;
						img.alt = 'Branding';
						img.className = 'branding-icon';
						el.appendChild( img );
						return el;
					}
					handleClick( event ) {
						event.preventDefault();
					}
				}

				if ( ! videojs.getComponent( 'CustomButton' ) ) {
					videojs.registerComponent( 'CustomButton', CustomButton );
				}

				controlBar.addChild( 'CustomButton', {} );
			}

			// Update existing branding image if needed
			const brandEl = document.querySelector( '.branding-icon' );
			if ( brandEl ) {
				brandEl.src = brandImage;
			}
		} else {
			// Remove branding button if image is cleared
			const customBtn = controlBar?.getChild( 'CustomButton' );
			if ( customBtn ) {
				controlBar.removeChild( customBtn );
			}
		}

		// Apply player skin class
		if ( mediaSettings?.video_player?.player_skin ) {
			const selectedSkin = mediaSettings.video_player.player_skin;

			// Remove previous skin classes
			const parent = videoElement.parentElement;

			// First remove all previous skin classes
			parent.classList.remove(
				'godam-minimal-skin',
				'godam-pills-skin',
				'godam-bubble-skin',
				'godam-classic-skin',
				'video-player-settings-preview',
			);

			parent.classList.add(
				'video-player-settings-preview',
			);

			// Then add the selected skin class
			if ( selectedSkin === 'Minimal' ) {
				parent.classList.add( 'godam-minimal-skin' );
			} else if ( selectedSkin === 'Pills' ) {
				parent.classList.add( 'godam-pills-skin' );
			} else if ( selectedSkin === 'Bubble' ) {
				parent.classList.add( 'godam-bubble-skin' );
			} else if ( selectedSkin === 'Classic' ) {
				parent.classList.add( 'godam-classic-skin' );
			}
		}
	}, [ mediaSettings?.video_player?.brand_color, mediaSettings?.video_player?.brand_image, mediaSettings?.video_player?.player_skin ] );

	// Add unsaved changes warning
	useEffect( () => {
		const handleBeforeUnload = ( event ) => {
			if ( isChanged ) {
				event.preventDefault();
				event.returnValue = __( 'You have unsaved changes. Are you sure you want to leave?', 'godam' );
			}
		};
		window.addEventListener( 'beforeunload', handleBeforeUnload );
		return () => window.removeEventListener( 'beforeunload', handleBeforeUnload );
	}, [ isChanged ] );

	const isMinimalOrClassic = 'Minimal' === mediaSettings?.video_player?.player_skin || 'Classic' === mediaSettings?.video_player?.player_skin;

	return (
		<>
			{ notice.isVisible && (
				<Notice
					className="mb-4"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }

			<div className="bg-neutral-50 p-6 rounded-lg shadow-sm">
				<div ref={ wrapperRef } className="text-center max-w-[650px] mx-auto shadow-xl rounded-lg overflow-hidden"></div>

				<div className="godam-settings__container__global-settings w-4/5 mt-9 mb-6 mx-auto">
					<div className="godam-form-group">
						<label className="label-text" htmlFor="brand-color">
							{ __( 'Player Skin', 'godam' ) }
						</label>

						<ComboboxControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							label=""
							onChange={ ( value ) => handleSettingChange( 'player_skin', value ) }
							options={ [
								{
									label: 'Default',
									value: 'Default',
								},
								{
									label: 'Classic',
									value: 'Classic',
								},
								{
									label: 'Minimal',
									value: 'Minimal',
								},
								{
									label: 'Pills',
									value: 'Pills',
								},
								{
									label: 'Bubble',
									value: 'Bubble',
								},
							] }
							value={ mediaSettings?.video_player?.player_skin || 'Default' }
							className="godam-player-skin-dropdown"
						/>
					</div>
					<div className="godam-form-group">
						<label className="label-text" htmlFor="brand-color">
							{ __( 'Brand color', 'godam' ) }
						</label>
						<div className="flex items-center gap-2">
							<ColorPickerButton
								label={ __( 'Brand color', 'godam' ) }
								value={ mediaSettings?.video_player?.brand_color }
								onChange={ ( value ) => handleSettingChange( 'brand_color', value ) }
								disabled={ isMinimalOrClassic }
							/>
							{ mediaSettings?.video_player?.brand_color && (
								<button
									type="button"
									className="text-xs text-red-500 underline hover:text-red-600 bg-transparent cursor-pointer"
									onClick={ () => handleSettingChange( 'brand_color', '' ) }
									aria-haspopup="true"
									aria-label={ __( 'Remove', 'godam' ) }
								>
									<Icon icon={ closeSmall } />
								</button>
							) }
						</div>

						<p className="text-[0.75rem] leading-[1.2] text-[#777]">
							{
								isMinimalOrClassic
									? ( <div className="flex items-center gap-2 mt-[-4px]">
										<Icon icon={ error } style={ { fill: '#EAB308' } } size={ 28 } />
										<p className="text-[#AB3A6C] text-[0.75rem] leading-[1.2]">{ __(
											'The brand color will not be applied to the player skin.',
											'godam',
										) }
										</p>
									</div>
									) : __(
										'Select a brand color to apply to the video block. This can be overridden for individual videos by the video editor',
										'godam',
									)
							}
						</p>
					</div>

					<BrandImageSelector
						mediaSettings={ mediaSettings }
						handleSettingChange={ handleSettingChange }
					/>
				</div>

				<div className="godam-form-group godam-settings__container__custom-css mb-8 mx-auto">
					<label className="label-text" htmlFor="brand-color">{ __( 'Custom CSS', 'godam' ) }</label>
					<CustomVideoPlayerCSS handleSettingChange={ handleSettingChange } />
					<div className="text-[0.75rem] leading-[1.2] text-[#777] mt-2">
						{ __( 'Any custom CSS you add will be applied to all player skins. It’s global and not tied to a specific skin style.', 'godam' ) }
					</div>
				</div>

				<Button
					variant="primary"
					className="godam-button"
					onClick={ handleSaveSettings }
					icon={ saveMediaSettingsLoading && <Spinner /> }
					isBusy={ saveMediaSettingsLoading }
					disabled={ saveMediaSettingsLoading || ! isChanged }
				>
					{ saveMediaSettingsLoading ? __( 'Saving…', 'godam' ) : __( 'Save', 'godam' ) }
				</Button>
			</div>
		</>
	);
};

export default VideoPlayer;
