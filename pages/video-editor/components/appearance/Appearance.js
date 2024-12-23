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
	ColorPicker,
	CustomSelectControl,
	Icon,
	RangeControl,
} from '@wordpress/components';
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
		<div className="p-4 pb-20">
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
							htmlFor="custom-play-button"
							name="hover-slider"
							className="font-bold"
						>
							Custom Brand Image
						</label>
						<Button
							onClick={ openBrandMediaPicker }
							variant="primary"
							className="ml-2 mt-2"
						>
							{ selectedBrandImage ? 'Replace' : 'Upload' }
						</Button>
						{ selectedBrandImage && (
							<div className="mt-2">
								<Icon
									icon={ 'no' }
									className="relative top-[25px] left-[60%] cursor-pointer"
									onClick={ removeBrandImage }
								/>
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
					<label htmlFor="control-position" className="font-bold">
						Select Play Button Alignment
					</label>
					<CustomSelectControl
						__next40pxDefaultSize
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
						<label name="hover-slider" className="font-bold">
							Icon zoom slider
						</label>
						<div className="hover-control-input-container">
							<RangeControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								help="Please select how transparent you would like this."
								initialPosition={ 0 }
								max={ 1 }
								min={ 0 }
								onChange={ handleControlsHoverZoomColor }
								step={ 0.1 }
								value={ videoConfig.controlBar.zoomLevel }
							/>
						</div>
					</div>
				</div>
				<div className="form-group">
					<label
						htmlFor="custom-play-button"
						name="hover-slider"
						className="font-bold"
					>
						Custom Play Button
					</label>
					<Button onClick={ openCustomBtnImg } variant="primary" className="ml-2">
						{ selectedCustomBgImg ? 'Replace' : 'Upload' }
					</Button>
					{ selectedCustomBgImg && (
						<div className="mt-2">
							<Icon
								icon={ 'no' }
								className="relative top-[30px] left-[60%] cursor-pointer"
								onClick={ removeCustomPlayBtnImage }
							/>
							<img
								src={ videoConfig.controlBar.customPlayBtnImg }
								alt={ 'Selected custom play button' }
								className="max-w-[200px] mt-2"
							/>
						</div>
					) }
				</div>
				<div className="form-group">
					<label htmlFor="control-bar-position" className="font-bold">
						Adjust position of control bar
					</label>

					<CustomSelectControl
						__next40pxDefaultSize
						onChange={ handleControlBarPosition }
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
					<label htmlFor="control-skip-position" className="font-bold">
						Adjust skip duration
					</label>
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
						value={ {
							key: videoConfig.controlBar.skipButtons.forward.toString(),
							name: videoConfig.controlBar.skipButtons.forward.toString(),
						} }
					/>
				</div>
				<div className="form-group">
					<label name="toggle-color" className="font-bold">
						Player Appearance
					</label>
					<ColorPicker
						d="toggle-color"
						onChange={ handleControlColorChange }
						color={ videoConfig.controlBar.appearanceColor }
						className="mt-2.5"
					/>
				</div>
				<div className="form-group">
					<label name="hover-color" className="font-bold">
						Select color on hover
					</label>
					<ColorPicker
						d="toggle-color"
						onChange={ handleControlsHoverColor }
						color={ videoConfig.controlBar.hoverColor }
						className="m-2.5"
					/>
				</div>
			</div>
		</div>
	);
};

export default Appearance;
