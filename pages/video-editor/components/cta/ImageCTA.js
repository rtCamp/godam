/**
 * External dependencies
 */
/**
 * WordPress dependencies
 */
import { Button, Icon, RangeControl, SelectControl, TextareaControl, TextControl } from '@wordpress/components';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

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
	const pathJoin = ( parts, sep = '/' ) => parts.join( sep ).replace( new RegExp( sep + '{1,}', 'g' ), sep );

	const openImageCTAUploader = () => {
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
		fetch( pathJoin( restURL, `/wp/v2/media/${ mediaId }` ) )
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
					Add Image
				</label>
				<Button
					onClick={ openImageCTAUploader }
					variant="primary"
					className="ml-2"
					aria-label="Upload or Replace CTA Image"
				>
					{ 0 === layer?.image || ! layer?.image ? 'Upload' : 'Replace' }
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
							alt={ 'Selected custom brand' }
							className="max-w-[200px]"
						/>
					</div>
				) }
			</div>

			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label="Text"
				value={ layer.imageText }
				onChange={ ( value ) => {
					updateField( 'imageText', value );
				} }
				placeholder="Your text"
			/>

			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label="URL"
				value={ layer.imageLink }
				onChange={ ( value ) => {
					updateField( 'imageLink', value );
				} }
				placeholder="https://rtcamp.com"
			/>

			<TextareaControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label="Description"
				value={ layer.imageDescription }
				onChange={ ( value ) => {
					updateField( 'imageDescription', value );
				} }
				placeholder="Your Description"
			/>

			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label="CTA Button Text"
				value={ layer.imageCtaButtonText }
				onChange={ ( value ) => {
					updateField( 'imageCtaButtonText', value );
				} }
				placeholder="Buy Now"
			/>

			<SelectControl
				__next40pxDefaultSize
				label="Select orientation"
				className="mb-4"
				options={ [
					{
						label: 'Landscape',
						value: 'landscape',
					},
					{
						label: 'Portrait',
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
						help="Please select how transparent you would like this."
						initialPosition={ 0 }
						max={ 1 }
						min={ 0 }
						onChange={ ( value ) => updateField( 'imageOpacity', value ) }
						step={ 0.1 }
						value={ layer.imageOpacity }
						label="Opacity of background image"
					/>
				</div>
			</div>
		</div>
	);
};

export default ImageCTA;
