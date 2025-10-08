/**
 * External dependencies
 */
import { useEffect, useState } from 'react';

/**
 * WordPress dependencies
 */
import {
	Modal,
	Button,
	TextControl,
	TextareaControl,
	ToggleControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './video-seo-modal.scss';
import { isSEODataEmpty } from '../utils';

/**
 * Video SEO Modal component
 *
 * @param {*}        param0
 * @param {boolean}  param0.isOpen        - Whether the modal is open
 * @param {Function} param0.setIsOpen     - Function to set modal open state
 * @param {Object}   param0.attributes    - Block attributes
 * @param {Function} param0.setAttributes - Function to set block attributes
 *
 * @return {JSX.Element|null} returns the Video SEO Modal component or null if not open
 */
export default function VideoSEOModal( { isOpen, setIsOpen, attributes, setAttributes } ) {
	const [ videoData, setVideoData ] = useState( {} );

	useEffect( () => {
		// Always initialize videoData when modal opens or attributes change
		const defaultVideoData = {
			contentUrl: '',
			headline: '',
			description: '',
			uploadDate: '',
			duration: '',
			thumbnailUrl: '',
			isFamilyFriendly: true,
		};

		// If SEO data exists in attributes, use it; otherwise use defaults
		const initialVideoData = {
			contentUrl: attributes?.seo?.contentUrl || defaultVideoData.contentUrl,
			headline: attributes?.seo?.headline || defaultVideoData.headline,
			description: attributes?.seo?.description || defaultVideoData.description,
			uploadDate: attributes?.seo?.uploadDate || defaultVideoData.uploadDate,
			duration: attributes?.seo?.duration || defaultVideoData.duration,
			thumbnailUrl: attributes?.seo?.thumbnailUrl || defaultVideoData.thumbnailUrl,
			isFamilyFriendly: attributes?.seo?.isFamilyFriendly !== undefined ? attributes.seo.isFamilyFriendly : defaultVideoData.isFamilyFriendly,
		};

		// Always update the local state with the latest data from attributes
		setVideoData( initialVideoData );

		// Only initialize attributes.seo if it's empty (for backward compatibility)
		if ( isSEODataEmpty( attributes.seo ) ) {
			setAttributes( {
				seo: initialVideoData,
			} );
		}
	}, [ attributes.seo, isOpen, setAttributes ] ); // Depend on seo attribute and modal state

	const updateField = ( field, value ) => {
		setVideoData( { ...videoData, [ field ]: value } );
	};

	const closeModal = () => {
		setIsOpen( false );
		// Reset videoData to current attributes when modal closes without saving
		const currentSEOData = {
			contentUrl: attributes?.seo?.contentUrl || '',
			headline: attributes?.seo?.headline || '',
			description: attributes?.seo?.description || '',
			uploadDate: attributes?.seo?.uploadDate || '',
			duration: attributes?.seo?.duration || '',
			thumbnailUrl: attributes?.seo?.thumbnailUrl || '',
			isFamilyFriendly: attributes?.seo?.isFamilyFriendly !== undefined ? attributes.seo.isFamilyFriendly : true,
		};
		setVideoData( currentSEOData );
	};

	const saveData = () => {
		setAttributes( {
			seo: videoData,
		} );
		closeModal();
	};

	if ( ! isOpen ) {
		return null;
	}

	return (
		<Modal
			title="Video SEO Schema"
			onRequestClose={ closeModal }
			className="godam-seo-modal"
		>
			<TextControl
				className="godam-seo-modal__property"
				label="Content URL"
				value={ videoData?.contentUrl || '' }
				onChange={ ( value ) => updateField( 'contentUrl', value ) }
				help={ __( 'URL of the video content can be MOV, MP4, MPD. Example: https://www.example.com/video.mp4', 'godam' ) }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label="Headline *"
				value={ videoData?.headline || '' }
				onChange={ ( value ) => updateField( 'headline', value ) }
				help={ __( 'Title of the video', 'godam' ) }
			/>
			<TextareaControl
				className="godam-seo-modal__property"
				label="Description"
				value={ videoData?.description || '' }
				onChange={ ( value ) => updateField( 'description', value ) }
				help={ __( 'Description of the video', 'godam' ) }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label="Upload Date"
				help="Format: YYYY-MM-DD"
				value={ videoData?.uploadDate || '' }
				onChange={ ( value ) => updateField( 'uploadDate', value ) }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label="Duration"
				disabled={ true }
				help="ISO 8601 format. Example: PT1H30M"
				value={ videoData?.duration || '' }
				onChange={ ( value ) => updateField( 'duration', value ) }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label="Video Thumbnail URL"
				value={ videoData?.thumbnailUrl || '' }
				onChange={ ( value ) => updateField( 'thumbnailUrl', value ) }
				help={ __( 'URL of the video thumbnail. Example: https://www.example.com/thumbnail.jpg', 'godam' ) }
			/>
			<ToggleControl
				className="godam-seo-modal__property"
				label="Is Family Friendly"
				checked={ videoData?.isFamilyFriendly || false }
				onChange={ ( value ) => updateField( 'isFamilyFriendly', value ) }
				help={ __( 'Is the video suitable for all audiences?', 'godam' ) }
			/>

			<div style={ { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' } }>
				<Button variant="tertiary" onClick={ closeModal }>
					{ __( 'Cancel', 'godam' ) }
				</Button>
				<Button variant="primary" onClick={ saveData }>
					{ __( 'Save', 'godam' ) }
				</Button>
			</div>
		</Modal>
	);
}
