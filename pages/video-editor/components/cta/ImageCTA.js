/**
 * External dependencies
 */
/**
 * WordPress dependencies
 */
import {
	Button,
	Notice,
	RangeControl, SelectControl,
	TextareaControl,
	TextControl,
	Icon,
	Tooltip,
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

	const imageOrientationOptions = [
		{
			label: __( 'Landscape', 'godam' ),
			value: 'landscape',
		},
		{
			label: __( 'Portrait', 'godam' ),
			value: 'portrait',
		},
	];

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

			dispatch(
				updateLayerField( {
					id: layer.id,
					field: 'image',
					value: attachment.id,
				} ),
			);
		} );

		fileFrame.open();
	};

	const updateField = ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	};

	const fetchOverlayMediaURL = useCallback( ( mediaId ) => {
		if ( ! mediaId ) {
			return;
		}
		fetch( window.pathJoin( [ restURL, `/wp/v2/media/${ mediaId }` ] ) )
			.then( ( response ) => {
				if ( ! response.ok ) {
					throw new Error( 'Media not found' );
				}
				return response.json();
			} )
			.then( ( media ) => {
				setSelectedImageUrl( media.source_url );
			} );
	},
	[ restURL, setSelectedImageUrl ] );

	useEffect( () => {
		if ( 'image' === layer?.cta_type && layer?.image ) {
			fetchOverlayMediaURL( layer.image );
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

	return (
		<div className="mt-2 flex flex-col gap-6">
			<div>
				<label
					htmlFor="custom-play-button"
					name="hover-slider"
					className="godam-input-label"
				>
					{ __( 'Add Image', 'godam' ) }
				</label>
				{ ( 0 === layer?.image || ! layer?.image ) && <Button
					onClick={ openImageCTAUploader }
					variant="primary"
					className="ml-2 godam-button"
					aria-label={ __( 'Upload or Replace CTA Image', 'godam' ) }
				>
					{ __( 'Upload', 'godam' ) }
				</Button> }
				{ ( layer?.image !== 0 && ! selectedImageUrl ) && ( <div className="mt-6 rounded-xl w-[160px] h-[160px] animate-pulse bg-gray-200"></div> ) }
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

			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				className="godam-input"
				label={ __( 'Text', 'godam' ) }
				value={ layer.imageText }
				onChange={ ( value ) => {
					updateField( 'imageText', value );
				} }
				placeholder={ __( 'Your text', 'godam' ) }
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
				placeholder={ __( 'Buy Now', 'godam' ) }
			/>

			<div className="flex items-center gap-2">
				<ColorPickerButton
					value={ layer?.imageCtaButtonColor ?? '#eeab95' }
					label={ __( 'CTA Button Background Color', 'godam' ) }
					className="mb-0"
					enableAlpha={ true }
					onChange={ debouncedColorUpdate }
				/>
				{ layer.imageCtaButtonColor && (
					<button
						type="button"
						className="text-xs text-red-500 underline hover:text-red-600 bg-transparent cursor-pointer"
						onClick={ () => updateField( 'imageCtaButtonColor', '#eeab95' )
						}
						aria-haspopup="true"
						aria-label={ __( 'Remove', 'godam' ) }
					>
						<Icon icon={ closeSmall } />
					</button>
				) }
			</div>

			<SelectControl
				__next40pxDefaultSize
				className="mb-4"
				label={ __( 'Select orientation', 'godam' ) }
				onChange={ ( value ) => {
					updateField( 'imageCtaOrientation', value );
				} }
				options={ imageOrientationOptions }
				value={ layer.imageCtaOrientation }
			/>

			<div className="mb-4">
				<div className="hover-control-input-container">
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						className="godam-input w-full"
						help={ __( 'Please select how transparent you would like this.', 'godam' ) }
						initialPosition={ 1 }
						max={ 1 }
						min={ 0 }
						onChange={ ( value ) => updateField( 'imageOpacity', value ) }
						step={ 0.1 }
						value={ layer.imageOpacity ?? 1 }
						label={ __( 'Opacity of background image', 'godam' ) }
					/>
				</div>
			</div>
		</div>
	);
};

export default ImageCTA;
