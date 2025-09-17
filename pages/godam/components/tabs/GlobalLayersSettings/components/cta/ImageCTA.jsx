/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';
import {
	Button,
	TextControl,
	TextareaControl,
	SelectControl,
	RangeControl,
	ColorPicker,
	Tooltip,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { replace, trash } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../../../../redux/slice/media-settings.js';

const ImageCTA = () => {
	const dispatch = useDispatch();
	const [ selectedImageUrl, setSelectedImageUrl ] = useState( '' );

	// Get media settings from Redux store
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'global_layers', subcategory: 'cta', key, value } ) );
	};

	const imageOrientationOptions = [
		{ label: __( 'Landscape', 'godam' ), value: 'landscape' },
		{ label: __( 'Portrait', 'godam' ), value: 'portrait' },
	];

	const openImageUploader = () => {
		const fileFrame = wp.media( {
			title: __( 'Select CTA Image', 'godam' ),
			button: {
				text: __( 'Use this Image', 'godam' ),
			},
			library: {
				type: 'image',
			},
			multiple: false,
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			if ( attachment.type !== 'image' ) {
				return;
			}

			handleSettingChange( 'image', attachment.id );
		} );

		fileFrame.open();
	};

	const fetchImageURL = useCallback( ( mediaId ) => {
		if ( ! mediaId || mediaId === 0 ) {
			setSelectedImageUrl( '' );
			return;
		}

		fetch( `${ window.wpApiSettings.root }wp/v2/media/${ mediaId }`, {
			headers: {
				'X-WP-Nonce': window.wpApiSettings.nonce,
			},
		} )
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
				setSelectedImageUrl( '' );
			} );
	}, [] );

	useEffect( () => {
		const imageId = mediaSettings?.global_layers?.cta?.image;
		if ( imageId && imageId !== 0 ) {
			fetchImageURL( imageId );
		} else {
			setSelectedImageUrl( '' );
		}
	}, [ mediaSettings?.global_layers?.cta?.image, fetchImageURL ] );

	const removeImage = () => {
		handleSettingChange( 'image', 0 );
		setSelectedImageUrl( '' );
	};

	return (
		<div className="mt-2 flex flex-col gap-6">
			<div>
				<div className="flex items-center gap-2 mb-2">
					<span className="godam-input-label">{ __( 'Add Image', 'godam' ) }</span>
					{ ( ! mediaSettings?.global_layers?.cta?.image || mediaSettings?.global_layers?.cta?.image === 0 ) && (
						<Button
							onClick={ openImageUploader }
							variant="primary"
							className="godam-button"
							aria-label={ __( 'Upload CTA Image', 'godam' ) }
						>
							{ __( 'Upload', 'godam' ) }
						</Button>
					) }
				</div>
				{ ( mediaSettings?.global_layers?.cta?.image && mediaSettings?.global_layers?.cta?.image !== 0 && ! selectedImageUrl ) ? (
					<div className="mt-6 rounded-xl w-[160px] h-[160px] animate-pulse bg-gray-200"></div>
				) : null }
				{ selectedImageUrl && (
					<div className="flex mt-4">
						<img
							src={ selectedImageUrl }
							alt={ __( 'Selected CTA image', 'godam' ) }
							className="w-[160px] h-[160px] rounded-xl object-cover"
						/>
						<div className="ml-[6px] flex flex-col">
							<Tooltip text={ __( 'Replace Image', 'godam' ) } placement="right">
								<Button className="!text-brand-neutral-900" icon={ replace } onClick={ openImageUploader } />
							</Tooltip>
							<Tooltip text={ __( 'Remove Image', 'godam' ) } placement="right">
								<Button className="mt-1" icon={ trash } isDestructive onClick={ removeImage } />
							</Tooltip>
						</div>
					</div>
				) }
			</div>

			<TextControl
				className="godam-input"
				label={ __( 'Text', 'godam' ) }
				value={ mediaSettings?.global_layers?.cta?.imageText || '' }
				onChange={ ( value ) => handleSettingChange( 'imageText', value ) }
				placeholder={ __( 'Your text', 'godam' ) }
			/>

			<TextControl
				className="godam-input"
				label={ __( 'URL', 'godam' ) }
				value={ mediaSettings?.global_layers?.cta?.imageLink || '' }
				onChange={ ( value ) => handleSettingChange( 'imageLink', value ) }
				placeholder="https://example.com"
			/>

			<TextareaControl
				className="godam-input"
				label={ __( 'Description', 'godam' ) }
				value={ mediaSettings?.global_layers?.cta?.imageDescription || '' }
				onChange={ ( value ) => handleSettingChange( 'imageDescription', value ) }
				placeholder={ __( 'Your Description', 'godam' ) }
			/>

			<TextControl
				className="godam-input"
				label={ __( 'CTA Button Text', 'godam' ) }
				value={ mediaSettings?.global_layers?.cta?.imageCtaButtonText || '' }
				onChange={ ( value ) => handleSettingChange( 'imageCtaButtonText', value ) }
				placeholder={ __( 'Buy Now', 'godam' ) }
			/>

			<div className="flex items-center gap-2 mb-4">
				<div>
					<label className="components-base-control__label" htmlFor="cta-button-color">{ __( 'CTA Button Background Color', 'godam' ) }</label>
					<ColorPicker
						color={ mediaSettings?.global_layers?.cta?.imageCtaButtonColor || '#eeab95' }
						onChange={ ( value ) => handleSettingChange( 'imageCtaButtonColor', value ) }
					/>
				</div>
			</div>

			<SelectControl
				className="godam-select mb-4 w-full md:w-1/3"
				label={ __( 'Select orientation', 'godam' ) }
				onChange={ ( value ) => handleSettingChange( 'imageCtaOrientation', value ) }
				options={ imageOrientationOptions }
				value={ mediaSettings?.global_layers?.cta?.imageCtaOrientation || 'landscape' }
			/>

			<RangeControl
				className="godam-input mb-4 w-full md:w-1/3"
				help={ __( 'Please select how transparent you would like this.', 'godam' ) }
				max={ 1 }
				min={ 0 }
				onChange={ ( value ) => handleSettingChange( 'imageOpacity', value ) }
				step={ 0.1 }
				value={ mediaSettings?.global_layers?.cta?.imageOpacity ?? 1 }
				label={ __( 'Opacity of background image', 'godam' ) }
			/>
		</div>
	);
};

export default ImageCTA;
