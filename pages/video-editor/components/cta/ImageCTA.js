/**
 * External dependencies
 */
/**
 * WordPress dependencies
 */
import { Button, Icon, RangeControl, TextControl } from '@wordpress/components';
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

	const fetchOverlayMediaURL = ( mediaId ) => {
		if ( ! mediaId ) {
			return;
		}
		fetch( `/wp-json/wp/v2/media/${ mediaId }` )
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
		dispatch(
			updateLayerField( {
				id: layer.id,
				field: 'image',
				value: 0,
			} ),
		);

		setSelectedImageUrl( '' );
	};

	console.log( 'Layer', layer );

	return (
		<div className="mt-2 flex flex-col gap-6">
			<div>
				<label
					htmlFor="custom-play-button"
					name="hover-slider"
					className="font-bold"
				>
					Add Image
				</label>
				<Button
					onClick={ openImageCTAUploader }
					variant="primary"
					className="ml-2"
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
					dispatch(
						updateLayerField( { id: layer.id, field: 'imageText', value } ),
					);
				} }
				placeholder="Your text"
			/>

			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label="URL"
				value={ layer.imageLink }
				onChange={ ( value ) => {
					dispatch(
						updateLayerField( { id: layer.id, field: 'imageLink', value } ),
					);
				} }
				placeholder="https://rtcamp.com"
			/>

			<div className="mt-4">
				<label name="hover-slider" className="font-bold">
					Opacity of background image
				</label>
				<div className="hover-control-input-container">
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						help="Please select how transparent you would like this."
						initialPosition={ 0 }
						max={ 1 }
						min={ 0 }
						onChange={ ( e ) =>
							dispatch(
								updateLayerField( {
									id: layer.id,
									field: 'imageOpacity',
									value: e,
								} ),
							)
						}
						step={ 0.1 }
						value={ layer.imageOpacity }
					/>
				</div>
			</div>
		</div>
	);
};

export default ImageCTA;
