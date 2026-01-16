/**
 * External dependencies
 */
/**
 * WordPress dependencies
 */
import {
	Button,
	Notice,
	TextareaControl,
	TextControl,
	Icon,
	Tooltip,
	RangeControl,
} from '@wordpress/components';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { __ } from '@wordpress/i18n';
import { closeSmall, replace, trash } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';

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

const ImageCTA = ( { layerID } ) => {
	/**
	 * State to manage the notice message and visibility.
	 */
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	/**
	 * To show a notice message.
	 *
	 * @param {string} message Text to display in the notice.
	 * @param {string} status  Status of the notice, can be 'success', 'error', etc.
	 */
	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
	};

	const [ selectedImageUrl, setSelectedImageUrl ] = useState( '' );
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const dispatch = useDispatch();

	const restURL = window.godamRestRoute.url || '';

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

			/**
			 * This handles the case for the uploader tab of WordPress media library.
			 */
			if ( attachment.type !== 'image' ) {
				showNotice( __( 'Only Image file is allowed', 'godam' ), 'error' );
				return;
			}

			if ( attachment.origin === 'godam' ) {
				// Update the layer for GoDAM hosted media.
				dispatch(
					updateLayerField( {
						id: layer.id,
						field: 'image',
						value: `godam_${ attachment.id }`,
					} ),
				);
				dispatch(
					updateLayerField( {
						id: layer.id,
						field: 'imageUrlExt',
						value: attachment.url,
					} ),
				);
			} else {
				// Update the layer for regular WordPress media.
				dispatch(
					updateLayerField( {
						id: layer.id,
						field: 'image',
						value: attachment.id,
					} ),
				);
				dispatch(
					updateLayerField( {
						id: layer.id,
						field: 'imageUrlExt',
						value: '',
					} ),
				);
			}
		} );

		fileFrame.open();
	};

	const updateField = ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	};

	const fetchOverlayMediaURL = useCallback( ( mediaId ) => {
		if ( ! mediaId || mediaId === 0 ) {
			setSelectedImageUrl( '' );
			return;
		}

		// Handle GoDAM hosted media.
		if ( typeof mediaId === 'string' && mediaId.startsWith( 'godam_' ) ) {
			if ( layer?.imageUrlExt ) {
				setSelectedImageUrl( layer.imageUrlExt );
			} else {
				setSelectedImageUrl( '' );
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
		}
	}, [ layer?.cta_type, layer?.image ] );

	const removeCTAImage = () => {
		updateField( 'image', 0 );

		setSelectedImageUrl( '' );
	};

	// prevent color picker flickering.
	const colorDebounceRef = useRef();

	const debouncedColorUpdate = useCallback(
		( value ) => {
			if ( colorDebounceRef.current ) {
				clearTimeout( colorDebounceRef.current );
			}
			colorDebounceRef.current = setTimeout( () => {
				updateField( 'imageCtaButtonColor', value );
			}, 150 );
		},
		[],
	);

	// Layout options
	const layoutOptions = [
		{ label: __( 'Text Left, Image Right (Full Height)', 'godam' ), value: 'card-layout--text-imagecover', icon: 'TextMediaCover' },
		{ label: __( 'Image Left, Text Right (Full Height)', 'godam' ), value: 'card-layout--imagecover-text', icon: 'MediaTextCover' },
		{ label: __( 'Text Left, Image Right', 'godam' ), value: 'card-layout--text-image', icon: 'TextMedia' },
		{ label: __( 'Image Left, Text Right', 'godam' ), value: 'card-layout--image-text', icon: 'MediaText' },
		{ label: __( 'Image Top, Text Bottom', 'godam' ), value: 'card-layout--image-top', icon: 'MediaTop' },
		{ label: __( 'Text Top, Image Bottom', 'godam' ), value: 'card-layout--image-bottom', icon: 'MediaBottom' },
		{ label: __( 'Image Background', 'godam' ), value: 'card-layout--image-background', icon: 'TextCoverMedia' },
		{ label: __( 'Text Only (No Image)', 'godam' ), value: 'desktop-text-only', icon: 'TextOnly' },
	];

	return (
		<div className="mt-2 flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<div className="godam-input-label">
					{ __( 'Layout', 'godam' ) }
				</div>
				<div className="grid grid-cols-4 gap-3">
					{ layoutOptions.map( ( layout ) => {
						const isSelected = ( layer?.cardLayout || 'card-layout--text-imagecover' ) === layout.value;
						const IconComponent = LayoutIcons[ layout.icon ];
						return (
							<Tooltip key={ layout.value } text={ layout.label } placement="top">
								<button
									type="button"
									onClick={ () => updateField( 'cardLayout', layout.value ) }
									className={ `flex items-center justify-center p-4 rounded-lg border-2 transition-all hover:border-brand-primary-500 hover:bg-brand-primary-50 ${
										isSelected
											? 'border-brand-primary-600 bg-brand-primary-50'
											: 'border-gray-300 bg-white'
									}` }
									aria-label={ layout.label }
									style={ {
										color: isSelected ? 'var(--wp-components-color-accent, #3858e9)' : '#6b7280',
									} }
								>
									<IconComponent />
								</button>
							</Tooltip>
						);
					} ) }
				</div>
			</div>

			<div>
				<label
					htmlFor="custom-play-button"
					name="hover-slider"
					className="godam-input-label"
				>
					{ __( 'Add Image', 'godam' ) }
				</label>
				{ ( layer?.image === 0 || ! layer?.image ) && (
					<Button
						onClick={ openImageCTAUploader }
						variant="primary"
						className="ml-2 godam-button"
						aria-label={ __( 'Upload or Replace CTA Image', 'godam' ) }
					>
						{ __( 'Upload', 'godam' ) }
					</Button>
				) }
				{ ( layer?.image && layer?.image !== 0 && ! selectedImageUrl ) ? (
					<div className="mt-6 rounded-xl w-[160px] h-[160px] animate-pulse bg-gray-200"></div>
				) : null }
				{ selectedImageUrl && (
					<div className="flex mt-4">
						<img
							src={ selectedImageUrl }
							alt={ __( 'Selected custom brand', 'godam' ) }
							className="w-[160px] h-[160px] rounded-xl object-cover"
						/>
						<div className="ml-[6px] flex flex-col">
							<Tooltip text={ __( 'Replace Image', 'godam' ) } placement="right">
								<Button className="!text-brand-neutral-900" icon={ replace } isDestructive onClick={ openImageCTAUploader } />
							</Tooltip>
							<Tooltip text={ __( 'Remove Image', 'godam' ) } placement="right">
								<Button className="mt-1" icon={ trash } isDestructive onClick={ removeCTAImage } />
							</Tooltip>
						</div>
					</div>
				) }
				{ notice.isVisible && (
					<Notice
						className="my-4"
						status={ notice.status }
						onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
					>
						{ notice.message }
					</Notice>
				) }
			</div>

			{ selectedImageUrl && (
				<RangeControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Image Width (%)', 'godam' ) }
					value={ layer?.imageWidth ?? 50 }
					onChange={ ( value ) => updateField( 'imageWidth', value ) }
					min={ 15 }
					max={ 85 }
					step={ 1 }
					help={ __( 'Applies to horizontal layouts only', 'godam' ) }
				/>
			) }

			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				className="godam-input"
				label={ __( 'Title', 'godam' ) }
				value={ layer.imageText }
				onChange={ ( value ) => {
					updateField( 'imageText', value );
				} }
				placeholder={ __( 'Add title here', 'godam' ) }
			/>

			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				className="godam-input"
				label={ __( 'URL', 'godam' ) }
				value={ layer.imageLink }
				onChange={ ( value ) => {
					updateField( 'imageLink', value );
				} }
				placeholder="https://rtcamp.com"
			/>

			<TextareaControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				className="godam-input"
				label={ __( 'Description', 'godam' ) }
				value={ layer.imageDescription }
				onChange={ ( value ) => {
					updateField( 'imageDescription', value );
				} }
				placeholder={ __( 'Your Description', 'godam' ) }
			/>

			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				className="godam-input"
				label={ __( 'CTA Button Text', 'godam' ) }
				value={ layer.imageCtaButtonText }
				onChange={ ( value ) => {
					updateField( 'imageCtaButtonText', value );
				} }
				placeholder={ __( 'Check now', 'godam' ) }
			/>

			<div className="flex items-center gap-2">
				<ColorPickerButton
					value={ layer?.imageCtaButtonColor ?? '#000000' }
					label={ __( 'CTA Button Background Color', 'godam' ) }
					className="mb-0"
					enableAlpha={ true }
					onChange={ debouncedColorUpdate }
				/>
				{ layer.imageCtaButtonColor && (
					<button
						type="button"
						className="text-xs text-red-500 underline hover:text-red-600 bg-transparent cursor-pointer"
						onClick={ () => updateField( 'imageCtaButtonColor', '#000000' )
						}
						aria-haspopup="true"
						aria-label={ __( 'Remove', 'godam' ) }
					>
						<Icon icon={ closeSmall } />
					</button>
				) }
			</div>
		</div>
	);
};

export default ImageCTA;
