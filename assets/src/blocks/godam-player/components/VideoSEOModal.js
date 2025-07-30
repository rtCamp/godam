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
import { isObjectEmpty } from '../utils';

export default function VideoSEOModal( { isOpen, setIsOpen, attributes, setAttributes } ) {
	const [ videoData, setVideoData ] = useState( {} );

	useEffect( () => {
		if ( attributes.seo && ! isObjectEmpty( attributes.seo ) ) {
			const initialVideoData = {
				contentUrl: attributes?.seo?.contentUrl || '',
				headline: attributes?.seo?.headline || '',
				description: attributes?.seo?.description || '',
				uploadDate: attributes?.seo?.uploadDate || '',
				duration: attributes?.seo?.duration || '',
				thumbnailUrl: attributes?.seo?.thumbnailUrl || '',
				isFamilyFriendly: attributes?.seo?.isFamilyFriendly || true,
			};

			setVideoData( initialVideoData );

			// Only set once if attributes.seo is empty
			if ( ! attributes?.seo || isObjectEmpty( attributes.seo ) ) {
				setAttributes( {
					...attributes,
					seo: initialVideoData,
				} );
			}
		}
	}, [ attributes, setAttributes ] ); // Remove isOpen from dependencies

	const updateField = ( field, value ) => {
		setVideoData( { ...videoData, [ field ]: value } );
	};

	const closeModal = () => setIsOpen( false );

	const saveData = () => {
		setAttributes( {
			...attributes,
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
				value={ videoData.contentUrl }
				onChange={ ( value ) => updateField( 'contentUrl', value ) }
				help={ __( 'URL of the video content can be MOV, MP4, MPD. Example: https://www.example.com/video.mp4', 'godam' ) }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label="Headline *"
				value={ videoData.headline }
				onChange={ ( value ) => updateField( 'headline', value ) }
				help={ __( 'Title of the video', 'godam' ) }
			/>
			<TextareaControl
				className="godam-seo-modal__property"
				label="Description"
				value={ videoData.description }
				onChange={ ( value ) => updateField( 'description', value ) }
				help={ __( 'Description of the video', 'godam' ) }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label="Upload Date"
				help="Format: YYYY-MM-DD"
				value={ videoData.uploadDate }
				onChange={ ( value ) => updateField( 'uploadDate', value ) }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label="Duration"
				disabled={ true }
				help="ISO 8601 format. Example: PT1H30M"
				value={ videoData.duration }
				onChange={ ( value ) => updateField( 'duration', value ) }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label="Video Thumbnail URL"
				value={ videoData.thumbnailUrl }
				onChange={ ( value ) => updateField( 'thumbnailUrl', value ) }
				help={ __( 'URL of the video thumbnail. Example: https://www.example.com/thumbnail.jpg', 'godam' ) }
			/>
			<ToggleControl
				className="godam-seo-modal__property"
				label="Is Family Friendly"
				checked={ videoData.isFamilyFriendly }
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
