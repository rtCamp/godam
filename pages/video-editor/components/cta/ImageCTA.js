/**
 * External dependencies
 */
/**
 * WordPress dependencies
 */
import { Button, Icon, RangeControl, SelectControl, TextareaControl, TextControl } from '@wordpress/components';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';

const ImageCTA = ( { layerID } ) => {
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

	const fetchOverlayMediaURL = ( mediaId ) => {
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
				setSelectedImageUrl( media.source_url ); // URL of the media file
			} );
	};

	useEffect( () => {
		fetchOverlayMediaURL( layer.image );
	}, [ layer ] );

	const removeCTAImage = () => {
		updateField( 'image', 0 );

		setSelectedImageUrl( '' );
	};

	return (
		<div className="mt-2 flex flex-col gap-6">
			<div>
				<label
					htmlFor="custom-play-button"
					name="hover-slider"
					className="custom-label"
				>
					{ __( 'Add Image', 'godam' ) }
				</label>
				<Button
					onClick={ openImageCTAUploader }
					variant="primary"
					className="ml-2"
					aria-label={ __( 'Upload or Replace CTA Image', 'godam' ) }
				>
					{ 0 === layer?.image || ! layer?.image ? __( 'Upload', 'godam' ) : __( 'Replace', 'godam' ) }
				</Button>
				{ selectedImageUrl && (
					<div className="mt-2">
						<Icon
							icon={ 'no' }
							className="relative top-[25px] left-[60%] cursor-pointer"
							onClick={ removeCTAImage }
						/>
						<img
							src={ selectedImageUrl }
							alt={ __( 'Selected custom brand', 'godam' ) }
							className="max-w-[200px]"
						/>
					</div>
				) }
			</div>

			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
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
				label={ __( 'CTA Button Text', 'godam' ) }
				value={ layer.imageCtaButtonText }
				onChange={ ( value ) => {
					updateField( 'imageCtaButtonText', value );
				} }
				placeholder={ __( 'Buy Now', 'godam' ) }
			/>

			<SelectControl
				__next40pxDefaultSize
				label={ __( 'Select orientation', 'godam' ) }
				className="mb-4"
				options={ [
					{
						label: __( 'Landscape', 'godam' ),
						value: 'landscape',
					},
					{
						label: __( 'Portrait', 'godam' ),
						value: 'portrait',
					},
				] }
				value={ layer.imageCtaOrientation }
				onChange={ ( value ) => {
					updateField( 'imageCtaOrientation', value );
				} }
			/>

			<div className="mb-4">
				<div className="hover-control-input-container">
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						help={ __( 'Please select how transparent you would like this.', 'godam' ) }
						initialPosition={ 0 }
						max={ 1 }
						min={ 0 }
						onChange={ ( value ) => updateField( 'imageOpacity', value ) }
						step={ 0.1 }
						value={ layer.imageOpacity }
						label={ __( 'Opacity of background image', 'godam' ) }
					/>
				</div>
			</div>
		</div>
	);
};

export default ImageCTA;
