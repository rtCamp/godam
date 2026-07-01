/**
 * External dependencies
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Notice, Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { trash, plus } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';
import { updateLayerField } from '../../redux/slice/videoSlice';
import { isValidURL } from '../../utils';
import { isActive as isGuideActive, suspend as suspendGuide, resume as resumeGuide } from '../../onboarding/productGuide';
import {
	VeSection,
	VeField,
	VeTextInput,
	VeTextarea,
	VeLayoutGrid,
	VeSlider,
	VeCollapsible,
	VeColorList,
} from '../controls';

const DEFAULT_BUTTON_BG = '#111';
const DEFAULT_BUTTON_TEXT = '#ffffff';
const DESCRIPTION_LIMIT = 200;

/**
 * Layout SVG Icon Components
 */
const LayoutIcons = {
	MediaTextCover: () => (
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="20" viewBox="0 0 28 20" fill="none">
			<rect x="0" y="0" width="13" height="20" rx="2" fill="currentColor" />
			<rect x="17" y="7" width="6" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="17" y="10" width="9" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="17" y="13" width="7" height="1.5" rx="0.75" fill="currentColor" />
		</svg>
	),
	TextMediaCover: () => (
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="20" viewBox="0 0 28 20" fill="none">
			<rect x="15" y="0" width="13" height="20" rx="2" fill="currentColor" />
			<rect x="2" y="7" width="6" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="2" y="10" width="9" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="2" y="13" width="7" height="1.5" rx="0.75" fill="currentColor" />
		</svg>
	),
	MediaText: () => (
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="20" viewBox="0 0 28 20" fill="none">
			<rect x="0" y="5" width="13" height="10" rx="2" fill="currentColor" />
			<rect x="17" y="7" width="6" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="17" y="10" width="9" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="17" y="13" width="7" height="1.5" rx="0.75" fill="currentColor" />
		</svg>
	),
	TextMedia: () => (
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="20" viewBox="0 0 28 20" fill="none">
			<rect x="15" y="5" width="13" height="10" rx="2" fill="currentColor" />
			<rect x="2" y="7" width="6" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="2" y="10" width="9" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="2" y="13" width="7" height="1.5" rx="0.75" fill="currentColor" />
		</svg>
	),
	MediaTop: () => (
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="20" viewBox="0 0 28 20" fill="none">
			<rect x="0" y="0" width="28" height="8" rx="2" fill="currentColor" />
			<rect x="0" y="11" width="12" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="0" y="14" width="20" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="0" y="17" width="16" height="1.5" rx="0.75" fill="currentColor" />
		</svg>
	),
	MediaBottom: () => (
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="20" viewBox="0 0 28 20" fill="none">
			<rect x="0" y="0" width="12" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="0" y="3" width="20" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="0" y="6" width="16" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="0" y="10" width="28" height="10" rx="2" fill="currentColor" />
		</svg>
	),
	TextCoverMedia: () => (
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="20" viewBox="0 0 28 20" fill="none">
			<rect width="28" height="20" rx="2" fill="currentColor" fillOpacity="0.3" />
			<rect x="8" y="7" width="12" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="6" y="10" width="16" height="1.5" rx="0.75" fill="currentColor" />
			<rect x="10" y="13" width="8" height="1.5" rx="0.75" fill="currentColor" />
		</svg>
	),
	TextOnly: () => (
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="20" viewBox="0 0 28 20" fill="none">
			<rect x="2" y="3" width="24" height="2" rx="1" fill="currentColor" />
			<rect x="2" y="7" width="20" height="2" rx="1" fill="currentColor" />
			<rect x="2" y="11" width="22" height="2" rx="1" fill="currentColor" />
			<rect x="2" y="15" width="18" height="2" rx="1" fill="currentColor" />
		</svg>
	),
};

/**
 * Derive a human-friendly file name from a media URL.
 *
 * @param {string} url Media source URL.
 * @return {string} File name.
 */
const fileNameFromUrl = ( url ) => {
	if ( ! url ) {
		return '';
	}
	try {
		const path = new URL( url, window.location.origin ).pathname;
		return decodeURIComponent( path.split( '/' ).pop() || '' );
	} catch ( e ) {
		return url.split( '/' ).pop() || '';
	}
};

/**
 * Format a byte count as a compact size string.
 *
 * @param {number} bytes Size in bytes.
 * @return {string} Formatted size (e.g. "14 KB").
 */
const formatSize = ( bytes ) => {
	if ( ! bytes || bytes <= 0 ) {
		return '';
	}
	if ( bytes < 1024 ) {
		return `${ bytes } B`;
	}
	if ( bytes < 1024 * 1024 ) {
		return `${ Math.round( bytes / 1024 ) } KB`;
	}
	return `${ ( bytes / ( 1024 * 1024 ) ).toFixed( 1 ) } MB`;
};

const CardCTA = ( { layerID, triggerSlot } ) => {
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const [ selectedImageUrl, setSelectedImageUrl ] = useState( '' );
	const [ selectedImageName, setSelectedImageName ] = useState( '' );
	const [ selectedImageSize, setSelectedImageSize ] = useState( '' );
	const [ urlError, setUrlError ] = useState( '' );

	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const dispatch = useDispatch();

	const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
	};

	const updateField = ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	};

	const removeCTAImage = () => {
		updateField( 'image', 0 );
		setSelectedImageUrl( '' );
		setSelectedImageName( '' );
		setSelectedImageSize( '' );
	};

	const openImageCTAUploader = () => {
		const fileFrame = wp.media( {
			title: __( 'Select Custom Background Image', 'godam' ),
			button: {
				text: __( 'Use this Background Image', 'godam' ),
			},
			library: {
				type: 'image', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			if ( attachment.type !== 'image' ) {
				showNotice( __( 'Only Image files are allowed', 'godam' ), 'error' );
				return;
			}

			if ( attachment.origin === 'godam' ) {
				// Update the layer for GoDAM hosted media.
				updateField( 'image', `godam_${ attachment.id }` );
				updateField( 'imageUrlExt', attachment.url );
			} else {
				// Update the layer for regular WordPress media.
				updateField( 'image', attachment.id );
				updateField( 'imageUrlExt', '' );
			}
		} );

		// While the product guide is running, its overlay + popover (z-index 1e9)
		// would sit on top of the media modal and conflict with selecting an image.
		// Hide the guide visuals for the duration of the picker and restore the
		// current step once it closes (whether the user selects or cancels).
		if ( isGuideActive() ) {
			suspendGuide();
			fileFrame.on( 'close', function() {
				resumeGuide();
			} );
		}

		fileFrame.open();
	};

	const fetchOverlayMediaURL = useCallback( ( mediaId ) => {
		if ( ! mediaId || mediaId === 0 ) {
			setSelectedImageUrl( '' );
			setSelectedImageName( '' );
			setSelectedImageSize( '' );
			return;
		}

		// Handle GoDAM hosted media — only the external URL is known.
		if ( typeof mediaId === 'string' && mediaId.startsWith( 'godam_' ) ) {
			if ( layer?.imageUrlExt ) {
				setSelectedImageUrl( layer.imageUrlExt );
				setSelectedImageName( fileNameFromUrl( layer.imageUrlExt ) );
				setSelectedImageSize( '' );
			} else {
				setSelectedImageUrl( '' );
				setSelectedImageName( '' );
				setSelectedImageSize( '' );
			}
			return;
		}

		// For regular WordPress media, fetch from the API.
		fetch( window.pathJoin( [ restURL, `/wp/v2/media/${ mediaId }` ] ) )
			.then( ( response ) => {
				if ( ! response.ok ) {
					throw new Error( 'Media not found' );
				}
				return response.json();
			} )
			.then( ( media ) => {
				setSelectedImageUrl( media.source_url );
				setSelectedImageName(
					media?.title?.rendered || fileNameFromUrl( media.source_url ),
				);
				setSelectedImageSize( formatSize( media?.media_details?.filesize ) );
			} )
			.catch( () => {
				removeCTAImage();
			} );
	},
	[ restURL, layer?.imageUrlExt ] );

	useEffect( () => {
		if ( 'image' === layer?.cta_type && layer?.image && layer?.image !== 0 ) {
			fetchOverlayMediaURL( layer.image );
		} else {
			setSelectedImageUrl( '' );
			setSelectedImageName( '' );
			setSelectedImageSize( '' );
		}
	}, [ layer?.cta_type, layer?.image ] );

	// Validate the existing button link on load and whenever the selected layer
	// changes, so a previously-saved invalid URL surfaces its error immediately.
	useEffect( () => {
		if ( layer?.imageLink && ! isValidURL( layer.imageLink ) ) {
			setUrlError( __( 'Please enter a valid URL (e.g., https://example.com)', 'godam' ) );
		} else {
			setUrlError( '' );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ layerID ] );

	const handleUrlChange = ( value ) => {
		updateField( 'imageLink', value );
		if ( value && ! isValidURL( value ) ) {
			setUrlError( __( 'Please enter a valid URL (e.g., https://example.com)', 'godam' ) );
		} else {
			setUrlError( '' );
		}
	};

	// prevent color picker flickering.
	const colorDebounceRef = useRef();
	const debouncedColorUpdate = useCallback(
		( field, value ) => {
			if ( colorDebounceRef.current ) {
				clearTimeout( colorDebounceRef.current );
			}
			colorDebounceRef.current = setTimeout( () => {
				dispatch( updateLayerField( { id: layerID, field, value } ) );
			}, 150 );
		},
		[ dispatch, layerID ],
	);

	// Layout options
	const layoutOptions = [
		{ label: __( 'Image Left, Text Right (Full Height)', 'godam' ), value: 'card-layout--imagecover-text', Icon: LayoutIcons.MediaTextCover, testId: 'godam-cta-button-layout-imagecover-text' },
		{ label: __( 'Text Left, Image Right (Full Height)', 'godam' ), value: 'card-layout--text-imagecover', Icon: LayoutIcons.TextMediaCover, testId: 'godam-cta-button-layout-text-imagecover' },
		{ label: __( 'Image Left, Text Right', 'godam' ), value: 'card-layout--image-text', Icon: LayoutIcons.MediaText, testId: 'godam-cta-button-layout-image-text' },
		{ label: __( 'Text Left, Image Right', 'godam' ), value: 'card-layout--text-image', Icon: LayoutIcons.TextMedia, testId: 'godam-cta-button-layout-text-image' },
		{ label: __( 'Image Top, Text Bottom', 'godam' ), value: 'card-layout--image-top', Icon: LayoutIcons.MediaTop, testId: 'godam-cta-button-layout-image-top' },
		{ label: __( 'Text Top, Image Bottom', 'godam' ), value: 'card-layout--image-bottom', Icon: LayoutIcons.MediaBottom, testId: 'godam-cta-button-layout-image-bottom' },
		{ label: __( 'Image Background', 'godam' ), value: 'card-layout--image-background', Icon: LayoutIcons.TextCoverMedia, testId: 'godam-cta-button-layout-image-background' },
		{ label: __( 'Text Only (No Image)', 'godam' ), value: 'desktop-text-only', Icon: LayoutIcons.TextOnly, testId: 'godam-cta-button-layout-text-only' },
	];

	const layoutsWithWidth = [ 'card-layout--text-imagecover', 'card-layout--imagecover-text', 'card-layout--text-image', 'card-layout--image-text' ];

	// Backward compatibility: determine default layout based on imageCtaOrientation
	const getDefaultLayout = () => {
		if ( ! layer?.imageCtaOrientation || layer?.imageCtaOrientation === 'landscape' ) {
			return 'card-layout--image-text';
		}
		return 'card-layout--image-top';
	};

	const currentLayout = layer?.cardLayout || getDefaultLayout();
	// Boolean() so `layer.image === 0` yields `false` (not the number 0), which
	// would otherwise render a literal "0" via the `{ … && }` JSX guards below.
	const hasImage = Boolean( layer?.image ) && layer?.image !== 0;
	const isLoadingImage = hasImage && ! selectedImageUrl;

	return (
		<>
			<VeSection title={ __( 'Card Layout', 'godam' ) }>
				<VeLayoutGrid
					options={ layoutOptions }
					value={ currentLayout }
					onChange={ ( value ) => updateField( 'cardLayout', value ) }
				/>
			</VeSection>

			{ currentLayout !== 'desktop-text-only' && (
				<VeSection title={ __( 'Image', 'godam' ) }>
					{ ! hasImage && (
						<>
							<Button
								className="godam-ve-media-select"
								variant="secondary"
								icon={ plus }
								onClick={ openImageCTAUploader }
								data-test-id="godam-cta-button-upload-image"
							>
								{ __( 'Select Image', 'godam' ) }
							</Button>
							<p className="godam-ve-media-hint">
								{ __( 'Recommended size: 100KB', 'godam' ) }
							</p>
						</>
					) }

					{ isLoadingImage && (
						<div className="godam-ve-media">
							<div className="godam-ve-media__thumb" style={ { background: '#f0f0f0' } } />
							<div className="godam-ve-media__meta">
								<span className="godam-ve-media__name">{ __( 'Loading…', 'godam' ) }</span>
							</div>
						</div>
					) }

					{ hasImage && selectedImageUrl && (
						<div className="godam-ve-media">
							<Tooltip text={ __( 'Click to replace image', 'godam' ) } placement="top">
								<button
									type="button"
									className="godam-ve-media__main"
									onClick={ openImageCTAUploader }
									aria-label={ __( 'Replace image', 'godam' ) }
									data-test-id="godam-cta-button-replace-image"
								>
									<img
										src={ selectedImageUrl }
										alt={ __( 'Selected CTA image', 'godam' ) }
										className="godam-ve-media__thumb"
									/>
									<span className="godam-ve-media__meta">
										<span className="godam-ve-media__name">
											{ selectedImageName || __( 'Image', 'godam' ) }
										</span>
										{ selectedImageSize && (
											<span className="godam-ve-media__size">{ selectedImageSize }</span>
										) }
									</span>
								</button>
							</Tooltip>
							<Tooltip text={ __( 'Remove image', 'godam' ) } placement="top">
								<Button
									className="godam-ve-media__remove"
									icon={ trash }
									isDestructive
									onClick={ removeCTAImage }
									data-test-id="godam-cta-button-remove-image"
								/>
							</Tooltip>
						</div>
					) }

					{ notice.isVisible && (
						<Notice
							status={ notice.status }
							onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
						>
							{ notice.message }
						</Notice>
					) }
				</VeSection>
			) }

			{ layoutsWithWidth.includes( currentLayout ) && currentLayout !== 'desktop-text-only' && (
				<VeSection title={ __( 'Width', 'godam' ) }>
					<VeSlider
						value={ layer?.imageWidth ?? 50 }
						onChange={ ( value ) => updateField( 'imageWidth', value ) }
						min={ 15 }
						max={ 85 }
						step={ 1 }
					/>
				</VeSection>
			) }

			{ triggerSlot }

			<VeSection title={ __( 'Card Title', 'godam' ) }>
				<VeTextInput
					label={ __( 'Card Title', 'godam' ) }
					value={ layer?.imageText }
					onChange={ ( value ) => updateField( 'imageText', value ) }
					placeholder={ __( 'Add title here', 'godam' ) }
					data-test-id="godam-cta-control-title"
				/>
				<VeTextarea
					label={ __( 'Description', 'godam' ) }
					help={ `${ __( 'Character limit', 'godam' ) }: ${ DESCRIPTION_LIMIT }` }
					value={ layer?.imageDescription }
					onChange={ ( value ) => updateField( 'imageDescription', value ) }
					placeholder={ __( 'Your description', 'godam' ) }
					maxLength={ DESCRIPTION_LIMIT }
					data-test-id="godam-cta-control-description"
				/>
			</VeSection>

			<VeCollapsible title={ __( 'Button Settings', 'godam' ) }>
				<VeTextInput
					label={ __( 'Button Title', 'godam' ) }
					value={ layer?.imageCtaButtonText }
					onChange={ ( value ) => updateField( 'imageCtaButtonText', value ) }
					placeholder={ __( 'Check now', 'godam' ) }
					data-test-id="godam-cta-control-button-text"
				/>
				<VeTextInput
					label={ __( 'Button Link', 'godam' ) }
					type="url"
					value={ layer?.imageLink }
					onChange={ handleUrlChange }
					placeholder="https://rtcamp.com"
					error={ urlError }
					data-test-id="godam-cta-control-url"
				/>
				<VeField label={ __( 'Button Colour', 'godam' ) }>
					<VeColorList>
						<ColorPickerButton
							className="godam-ve-color-row"
							value={ layer?.imageCtaButtonTextColor ?? DEFAULT_BUTTON_TEXT }
							label={ __( 'Text', 'godam' ) }
							enableAlpha={ true }
							onChange={ ( value ) => debouncedColorUpdate( 'imageCtaButtonTextColor', value ) }
						/>
						<ColorPickerButton
							className="godam-ve-color-row"
							value={ layer?.imageCtaButtonColor ?? DEFAULT_BUTTON_BG }
							label={ __( 'Background', 'godam' ) }
							enableAlpha={ true }
							onChange={ ( value ) => debouncedColorUpdate( 'imageCtaButtonColor', value ) }
						/>
					</VeColorList>
				</VeField>
			</VeCollapsible>
		</>
	);
};

export default CardCTA;
export { LayoutIcons };
