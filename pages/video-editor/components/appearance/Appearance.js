/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';

/**
 * Internal dependencies
 */
import '../../video-control.css';
/**
 * WordPress dependencies
 */
import {
	Button,
	CheckboxControl,
	CustomSelectControl,
	Icon,
	RangeControl,
	ColorPalette,
	TabPanel,
	TextareaControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelector } from 'react-redux';
import { updateVideoConfig } from '../../redux/slice/videoSlice';
import EasyDAM from '../../../../assets/src/images/EasyDAM.png';

const Appearance = () => {
	const dispatch = useDispatch();
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const [ selectedBrandImage, setSelectedBrandImage ] = useState( videoConfig.controlBar.customBrandImg.length > 0 );
	const [ selectedCustomBgImg, setSelectedCustomBgImg ] = useState(
		videoConfig.controlBar.customPlayBtnImg.length > 0,
	);

	useEffect( () => {
		//class gets re added upon component load, so we need to remove it.
		if ( videoConfig.controlBar.subsCapsButton ) {
			document
				.querySelector( '.vjs-subs-caps-button' )
				.classList.remove( 'vjs-hidden' );
		}
	}, [] );

	function handleVolumeToggle() {
		const volumeSlider = document.querySelector( '.vjs-volume-panel' );
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					volumePanel: ! videoConfig.controlBar.volumePanel,
				},
			} ),
		);
		if ( volumeSlider.classList.contains( 'hide' ) ) {
			volumeSlider.classList.remove( 'hide' );
			volumeSlider.classList.add( 'show' );
		} else {
			volumeSlider.classList.add( 'hide' );
			volumeSlider.classList.remove( 'show' );
		}
	}

	function handleCaptionsToggle() {
		const captionsButton = document.querySelector( '.vjs-subs-caps-button' );
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					subsCapsButton: ! videoConfig.controlBar.subsCapsButton,
				},
			} ),
		);

		if ( captionsButton.classList.contains( 'show' ) ) {
			captionsButton.classList.add( 'hide' );
			captionsButton.classList.remove( 'show' );
		} else {
			captionsButton.classList.remove( 'hide' );
			captionsButton.classList.add( 'show' );
		}
	}

	function handleBrandingToggle( e ) {
		const brandingLogo = document.querySelector( '#branding-icon' );
		const controlBar = document.querySelector( '.vjs-control-bar' );

		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					brandingIcon: ! videoConfig.controlBar.brandingIcon,
				},
			} ),
		);

		if ( brandingLogo ) {
			controlBar.removeChild( brandingLogo );
		} else {
			controlBar.appendChild( brandingLogo );
		}
	}

	function handleControlColorChange( e ) {
		const selectedColor = e;
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					appearanceColor: selectedColor,
				},
			} ),
		);
		const controlBar = document.querySelector( '.vjs-control-bar' );
		const bigPlayButton = document.querySelector( '.vjs-big-play-button' );
		controlBar.style.setProperty(
			'background-color',
			selectedColor,
			'important',
		);
		bigPlayButton.style.setProperty(
			'background-color',
			selectedColor,
			'important',
		);
	}

	function handleControlsHoverColor( e ) {
		const selectedColor = e;
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					hoverColor: selectedColor,
				},
			} ),
		);
		const controlBar = document.querySelector( '.vjs-control-bar' );
		const controls = controlBar.querySelectorAll( '.vjs-control' );
		controls.forEach( ( control ) => {
			// On hover
			control.addEventListener( 'mouseenter', function() {
				control.style.color = selectedColor;
			} );

			control.addEventListener( 'mouseleave', function() {
				control.style.color = '#fff'; // Reset to default
			} );
		} );

		document
			.querySelector( '.vjs-slider-bar' )
			.addEventListener( 'mouseenter', function() {
				this.style.backgroundColor = selectedColor;
			} );

		document
			.querySelector( '.vjs-control-bar' )
			.addEventListener( 'mouseleave', function() {
				document.querySelector( '.vjs-slider-bar' ).style.backgroundColor =
          '#fff';
			} );
	}

	function handleControlsHoverZoomColor( e ) {
		const selectedZoomVal = 1 + parseFloat( e );

		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					zoomLevel: parseFloat( e ),
				},
			} ),
		);

		const controlBar = document.querySelector( '.vjs-control-bar' );
		const controls = controlBar.querySelectorAll( '.vjs-control' );

		controls.forEach( ( control ) => {
			if ( ! control.className.includes( 'vjs-progress-control' ) ) {
				// On hover
				control.addEventListener( 'mouseenter', function() {
					this.style.transform = `scale(${ selectedZoomVal })`;
				} );

				control.addEventListener( 'mouseleave', function() {
					this.style.transform = 'scale(1)'; // Reset to default
				} );
			}
		} );
	}

	function handlePlayButtonPosition( e ) {
		const playButton = document.querySelector( '.vjs-big-play-button' );

		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					playButtonPosition: e.selectedItem.key,
				},
			} ),
		);

		if ( playButton ) {
			const alignments = [
				'left-align',
				'center-align',
				'right-align',
				'top-align',
				'bottom-align',
			];
			playButton.classList.remove( ...alignments ); // Remove all alignment classes
			if ( alignments.includes( `${ e.selectedItem.key }-align` ) ) {
				playButton.classList.add( `${ e.selectedItem.key }-align` ); // Add the selected alignment class
			}
		}
	}

	const openCustomBtnImg = () => {
		setSelectedCustomBgImg( true );
		const fileFrame = wp.media( {
			title: 'Select Custom Background Image',
			button: {
				text: 'Use this Background Image',
			},
			library: {
				type: 'image', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();
			const playButtonElement = document.querySelector( '.vjs-big-play-button' );

			dispatch(
				updateVideoConfig( {
					controlBar: {
						...videoConfig.controlBar,
						customPlayBtnImg: attachment.url,
					},
				} ),
			);

			// Apply custom background via class
			playButtonElement.style.backgroundImage = `url(${ attachment.url })`;
			playButtonElement.classList.add( 'custom-bg' ); // Add the custom CSS class
		} );

		fileFrame.open();
	};

	const openBrandMediaPicker = () => {
		setSelectedBrandImage( true );
		const fileFrame = wp.media( {
			title: 'Select Brand Image',
			button: {
				text: 'Use this brand image',
			},
			library: {
				type: 'image', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();
			const brandImg = document.querySelector( '#branding-icon' );

			dispatch(
				updateVideoConfig( {
					controlBar: {
						...videoConfig.controlBar,
						customBrandImg: attachment.url,
					},
				} ),
			);

			if ( brandImg ) {
				brandImg.src = `${ attachment.url }`;
			}
		} );

		fileFrame.open();
	};

	const removeBrandImage = () => {
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					customBrandImg: '',
				},
			} ),
		);
		setSelectedBrandImage( false );
		const brandImg = document.querySelector( '#branding-icon' );
		if ( brandImg ) {
			brandImg.src = EasyDAM;
		}
	};

	const removeCustomPlayBtnImage = () => {
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					customPlayBtnImg: '',
				},
			} ),
		);
		setSelectedCustomBgImg( false );
		const playButtonElement = document.querySelector( '.vjs-big-play-button' );
		playButtonElement.style.backgroundImage = '';
	};

	function handleUploadCustomBrandImg( e ) {
		const file = e.target.files[ 0 ];
		if ( file ) {
			const reader = new FileReader();
			reader.onload = function( e ) {
				const brandImg = document.querySelector( '#branding-icon' );

				if ( brandImg ) {
					brandImg.src = `${ e.target.result }`;
				}
			};
			reader.readAsDataURL( file );
		}
	}

	function handleSkipTimeSettings( e ) {
		const selectedSkipVal = parseFloat( e.selectedItem.name );
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
			  	skipButtons: {
				  forward: selectedSkipVal,
				  backward: selectedSkipVal,
		  		},
				},
			} ),
		);
		const skipBackwardButton = document.querySelector(
			'[class^="vjs-skip-backward-"]',
		);
		const skipForwardButton = document.querySelector(
			'[class^="vjs-skip-forward-"]',
		);

		const backwardClasses = Array.from( skipBackwardButton.classList );
		const existingBackwardClass = backwardClasses.find( ( cls ) =>
			cls.startsWith( 'vjs-skip-backward-' ),
		);

		if ( existingBackwardClass ) {
			skipBackwardButton.classList.replace(
				existingBackwardClass,
				`vjs-skip-backward-${ selectedSkipVal }`,
			);
		}

		const forwardClasses = Array.from( skipForwardButton.classList );
		const existingForwardClass = forwardClasses.find( ( cls ) =>
			cls.startsWith( 'vjs-skip-forward-' ),
		);

		if ( existingForwardClass ) {
			skipForwardButton.classList.replace(
				existingForwardClass,
				`vjs-skip-forward-${ selectedSkipVal }`,
			);
		}
	}

	function handleControlBarPosition( e ) {
		const selectedValue = e.selectedItem.key;
		dispatch(
			updateVideoConfig( {
				controlBar: {
					...videoConfig.controlBar,
					controlBarPosition: selectedValue,
				},
			} ),
		);
		const controlBar = document.querySelector( '.vjs-control-bar' );
		controlBar.classList.add( 'vjs-control-bar-vertical' );

		const controls = document.getElementsByClassName( 'vjs-control' );

		if ( 'vertical' === selectedValue ) {
			for ( const control of controls ) {
				control.classList.add( 'vjs-control-vertical' );
				if ( control.classList.contains( 'vjs-volume-panel' ) ) {
					control.classList.add( 'vjs-volume-panel-vertical' );
					control.classList.remove( 'vjs-volume-panel-horizontal' );
				}

				if ( control.classList.contains( 'vjs-volume-horizontal' ) ) {
					control.classList.add( 'vjs-volume-vertical' );
				}
			}
		} else {
			controlBar.classList.remove( 'vjs-control-bar-vertical' );
			for ( const control of controls ) {
				control.classList.remove( 'vjs-control-vertical' );

				if ( control.classList.contains( 'vjs-volume-panel' ) ) {
					control.classList.remove( 'vjs-volume-panel-vertical' );
					control.classList.add( 'vjs-volume-panel-horizontal' );
				}

				if ( control.classList.contains( 'vjs-volume-horizontal' ) ) {
					control.classList.remove( 'vjs-volume-vertical' );
				}
			}
		}
	}

	return (
		<div id="easydam-player-settings" className="p-4 pb-20">
			<div className="accordion-item--content mt-2 flex flex-col gap-6">
				<div className="flex flex-col gap-5">
					<div className="form-group flex items-center gap-10">
						<CheckboxControl
							__nextHasNoMarginBottom
							label="Show Volume Slider"
							checked={ videoConfig.controlBar.volumePanel }
							onChange={ handleVolumeToggle }
						/>
					</div>
					<div className="form-group flex items-center gap-10">
						<CheckboxControl
							__nextHasNoMarginBottom
							label="Display Captions"
							onChange={ handleCaptionsToggle }
							checked={ videoConfig.controlBar.subsCapsButton }
						/>
					</div>
					<div className="form-group flex items-center gap-10">
						<CheckboxControl
							__nextHasNoMarginBottom
							label="Show Branding"
							onChange={ handleBrandingToggle }
							checked={ videoConfig.controlBar.brandingIcon }
						/>
					</div>
				</div>
				{ videoConfig.controlBar.brandingIcon && (
					<div className="form-group">
						<label
							htmlFor="custom-brand-logo"
							className="easydam-label"
						>
							{ __( 'Custom Brand Logo', 'transcoder' ) }
						</label>
						<Button
							onClick={ openBrandMediaPicker }
							variant="primary"
							className="mr-2"
						>
							{ selectedBrandImage ? 'Replace' : 'Upload' }
						</Button>
						{ selectedBrandImage && (
							<Button onClick={ removeBrandImage } variant="secondary" isDestructive>
								{ __( 'Remove', 'transcoder' ) }
							</Button>
						) }
						{ selectedBrandImage && (
							<div className="mt-2">
								<img
									src={ videoConfig.controlBar.customBrandImg }
									alt={ 'Selected custom brand' }
									className="max-w-[200px]"
								/>
							</div>
						) }
					</div>
				) }
				<div className="form-group">
					<CustomSelectControl
						__next40pxDefaultSize
						label={ __( 'Play Button Position', 'transcoder' ) }
						onChange={ handlePlayButtonPosition }
						options={ [
							{
								key: 'center',
								name: 'Center',
							},
							{
								key: 'left',
								name: 'Left',
							},
							{
								key: 'top',
								name: 'Top',
							},
							{
								key: 'bottom',
								name: 'Bottom',
							},
							{
								key: 'right',
								name: 'Right',
							},
						] }
						value={ {
							key: videoConfig.controlBar.playButtonPosition,
							name: videoConfig.controlBar.playButtonPosition,
						} }
					/>
				</div>
				<div className="form-group">
					<div id="hover-control-container">
						<div className="hover-control-input-container">
							<RangeControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								help={ __( 'scale up the player controls icons on hover', 'transcoder' ) }
								initialPosition={ 0 }
								max={ 1 }
								min={ 0 }
								label={ __( 'Zoom Level', 'transcoder' ) }
								onChange={ handleControlsHoverZoomColor }
								step={ 0.1 }
								value={ videoConfig.controlBar.zoomLevel }
							/>
						</div>
					</div>
				</div>
				<div className="form-group">
					<label
						htmlFor="custom-hover-color"
						className="easydam-label"
					>
						{ __( 'Custom Play Button', 'transcoder' ) }
					</label>
					<Button onClick={ openCustomBtnImg } variant="primary" className="mr-2">
						{ selectedCustomBgImg ? __( 'Replace', 'transcoder' ) : __( 'Upload', 'transcoder' ) }
					</Button>
					{ selectedCustomBgImg && (
						<Button onClick={ removeCustomPlayBtnImage } variant="secondary" isDestructive>
							{ __( 'Remove', 'transcoder' ) }
						</Button>
					) }
					{ selectedCustomBgImg && (
						<div className="mt-2">
							<img
								src={ videoConfig.controlBar.customPlayBtnImg }
								alt={ 'Selected custom play button' }
								className="max-w-[200px] mt-2"
							/>
						</div>
					) }
				</div>
				<div className="form-group">
					<CustomSelectControl
						__next40pxDefaultSize
						onChange={ handleControlBarPosition }
						label={ __( 'Adjust position of control bar', 'transcoder' ) }
						options={ [
							{
								key: 'horizontal',
								name: 'Horizontal',
							},
							{
								key: 'vertical',
								name: 'Vertical',
							},
						] }
						value={ {
							key: videoConfig.controlBar.controlBarPosition,
							name: videoConfig.controlBar.controlBarPosition,
						} }
					/>
				</div>
				<div className="form-group">
					<CustomSelectControl
						__next40pxDefaultSize
						onChange={ handleSkipTimeSettings }
						options={ [
							{
								key: '10',
								name: '10',
							},
							{
								key: '5',
								name: '5',
							},
							{
								key: '30',
								name: '30',
							},
						] }
						label={ __( 'Adjust skip duration', 'transcoder' ) }
						value={ {
							key: videoConfig.controlBar.skipButtons.forward.toString(),
							name: videoConfig.controlBar.skipButtons.forward.toString(),
						} }
					/>
				</div>
				<div className="form-group">
					<label
						htmlFor="appearance-color"
						className="text-[11px] uppercase font-medium mb-2 block"
					>
						{ __( 'Player Appearance', 'transcoder' ) }
					</label>
					<ColorPalette
						value={ videoConfig.controlBar.appearanceColor }
						enableAlpha={ true }
						onChange={ ( value ) => {
							if ( ! value ) {
								value = '#2b333fb3';
							}
							dispatch(
								updateVideoConfig( {
									controlBar: {
										...videoConfig.controlBar,
										appearanceColor: value,
									},
								} ),
							);
						} }
					/>
				</div>
				<div className="form-group">
					<label
						htmlFor="custom-hover-color"
						className="text-[11px] uppercase font-medium mb-2 block"
					>
						{ __( 'Select color on hover', 'transcoder' ) }
					</label>
					<ColorPalette
						value={ videoConfig.controlBar.hoverColor }
						enableAlpha={ true }
						onChange={ ( value ) => {
							if ( ! value ) {
								value = '#fff';
							}
							dispatch(
								updateVideoConfig( {
									controlBar: {
										...videoConfig.controlBar,
										hoverColor: value,
									},
								} ),
							);
						} }
					/>
				</div>

				<div className="form-group">
					<label
						htmlFor="custom-hover-color"
						className="text-[11px] uppercase font-medium mb-2 block"
					>
						{ __( 'Select Ad server', 'transcoder' ) }
					</label>
					<TabPanel
						onSelect={ ( val ) => {
							dispatch(
								updateVideoConfig( {
									adServer: val,
								} ),
							);
						} }
						initialTabName={ videoConfig.adServer ?? 'self-hosted' }
						className="button-tabs"
						tabs={ [
							{
								name: 'self-hosted',
								title: 'Self Hosted Ads',
								className: 'flex-1 justify-center items-center',
								component: null,
							},
							{
								name: 'ad-server',
								title: "Ad Server\'s Ads",
								className: 'flex-1 justify-center items-center',
								component: <div className="mt-2">
									<TextareaControl
										label={ __( 'adTag URL', 'transcoder' ) }
										help={ <>
											<div>
												{ __( 'A VAST ad tag URL is used by a player to retrieve video and audio ads ', 'transcoder' ) }
												<a href="https://support.google.com/admanager/answer/177207?hl=en" target="_blank" rel="noreferrer noopener" className="text-blue-500 underline">{ __( 'Learn more.', 'transcoder' ) }</a>
											</div>
										</>
										}
										value={ videoConfig.adTagURL }
										onChange={ ( val ) => {
											dispatch(
												updateVideoConfig( {
													adTagURL: val,
												} ),
											);
										} }
									/>
								</div>,
							},
						] }
					>
						{ ( tab ) => tab.component }
					</TabPanel>
				</div>
			</div>
		</div>
	);
};

export default Appearance;
