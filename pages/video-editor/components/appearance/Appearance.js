/**
 * External dependencies
 */
import React, { useState } from 'react';

/**
 * Internal dependencies
 */
import EasyDAM from '../../../../assets/src/images/EasyDAM.png';
import '../../video-control.css';
/**
 * WordPress dependencies
 */
import {
	CheckboxControl,
	ColorPicker,
	CustomSelectControl,
	RangeControl,
} from '@wordpress/components';
import { useDispatch } from 'react-redux';
import { updateSkipTime } from '../../redux/slice/videoSlice';

const Appearance = () => {
	const [ volumePanel, setVolumePanel ] = useState( true );
	const [ showBrandingIcon, setShowBrandingIcon ] = useState( false );
	const [ showCaptions, setShowCaptions ] = useState( false );
	const dispatch = useDispatch();

	function handleVolumeToggle() {
		setVolumePanel( ! volumePanel );
		const volumeSlider = document.querySelector( '.vjs-volume-panel' );
		if ( volumeSlider.classList.contains( 'hide' ) ) {
			volumeSlider.classList.remove( 'hide' );
			volumeSlider.classList.add( 'show' );
		} else {
			volumeSlider.classList.add( 'hide' );
			volumeSlider.classList.remove( 'show' );
		}
	}

	function handleCaptionsToggle() {
		setShowCaptions( ! showCaptions );
		const captionsButton = document.querySelector( '.vjs-subs-caps-button' );
		captionsButton.classList.remove( 'vjs-hidden' ); //temp
		if ( captionsButton.classList.contains( 'show' ) ) {
			captionsButton.classList.add( 'hide' );
			captionsButton.classList.remove( 'show' );
		} else {
			captionsButton.classList.remove( 'hide' );
			captionsButton.classList.add( 'show' );
		}
	}

	function handleBrandingToggle( e ) {
		setShowBrandingIcon( ! showBrandingIcon );
		const controlBar = document.querySelector( '.vjs-control-bar' );
		const img = document.createElement( 'img' );
		img.src = EasyDAM;
		img.id = 'branding-icon';
		img.alt = 'Branding';
		const brandingLogo = document.querySelector( '#branding-icon' );

		if ( brandingLogo ) {
			controlBar.removeChild( brandingLogo );
		} else {
			controlBar.appendChild( img );
		}
	}

	function handleControlColorChange( e ) {
		const selectedColor = e;
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

	function handleUploadCustomBtnBg( e ) {
		const file = e.target.files[ 0 ];
		if ( file ) {
			const reader = new FileReader();
			reader.onload = function( e ) {
				const playButtonElement = document.querySelector(
					'.vjs-big-play-button',
				);

				// Apply custom background via class
				playButtonElement.style.backgroundImage = `url(${ e.target.result })`;
				playButtonElement.classList.add( 'custom-bg' ); // Add the custom CSS class
			};
			reader.readAsDataURL( file );
		}
	}

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
		dispatch( updateSkipTime( { selectedSkipVal } ) );
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
							checked={ volumePanel }
							onChange={ handleVolumeToggle }
						/>
					</div>
					<div className="form-group flex items-center gap-10">
						<CheckboxControl
							__nextHasNoMarginBottom
							label="Display Captions"
							onChange={ handleCaptionsToggle }
							checked={ showCaptions }
						/>
					</div>
					<div className="form-group flex items-center gap-10">
						<CheckboxControl
							__nextHasNoMarginBottom
							label="Show Branding"
							onChange={ handleBrandingToggle }
							checked={ showBrandingIcon }
						/>
					</div>
				</div>
				{ showBrandingIcon && (
					<div className="form-group">
						<label
							htmlFor="custom-play-button"
							name="hover-slider"
							className="font-bold"
						>
							Custom Brand Image
						</label>
						<input
							type="file"
							id="custom-play-button"
							accept="image/*"
							onChange={ handleUploadCustomBrandImg }
						/>
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
					<input
						type="file"
						id="custom-play-button"
						accept="image/*"
						onChange={ handleUploadCustomBtnBg }
					/>
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
					/>
				</div>
				<div className="form-group">
					<label name="toggle-color" className="font-bold">
						Player Appearance
					</label>
					<ColorPicker d="toggle-color" onChange={ handleControlColorChange } />
				</div>
				<div className="form-group">
					<label name="hover-color" className="font-bold">
						Select color on hover
					</label>
					<ColorPicker d="toggle-color" onChange={ handleControlsHoverColor } />
				</div>
			</div>
		</div>
	);
};

export default Appearance;
