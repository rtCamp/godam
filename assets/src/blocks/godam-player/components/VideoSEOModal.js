/**
 * External dependencies
 */
import React, { useEffect, useRef, useState } from 'react';

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
import { getFirstNonEmpty, appendTimezoneOffsetToUTC, isObjectEmpty } from '../utils';

export default function VideoSEOModal( { isOpen, setIsOpen, attachmentData, attributes, setAttributes, duration } ) {
	const [ videoData, setVideoData ] = useState( {} );

	const hasInitialized = useRef( false );

	useEffect( () => {
		if ( attachmentData && ! isObjectEmpty( attachmentData ) && ! hasInitialized.current ) {
			const initialVideoData = {
				contentUrl: getFirstNonEmpty( attributes?.seo?.contentUrl, attachmentData?.meta?.rtgodam_transcoded_url, attachmentData?.source_url ),
				headline: getFirstNonEmpty( attributes?.seo?.headline, attachmentData?.title?.rendered ),
				description: getFirstNonEmpty( attributes?.seo?.description, attachmentData?.description?.rendered ),
				uploadDate: getFirstNonEmpty( attributes?.seo?.uploadDate, appendTimezoneOffsetToUTC( attachmentData?.date_gmt ) ),
				duration: getFirstNonEmpty( attributes?.seo?.duration, attachmentData?.video_duration_iso8601 ),
				thumbnailUrl: getFirstNonEmpty( attributes?.seo?.thumbnailUrl, attachmentData?.meta?.rtgodam_media_video_thumbnail ),
				isFamilyFriendly: getFirstNonEmpty( attributes?.seo?.isFamilyFriendly, true ),
			};

			setVideoData( initialVideoData );

			setAttributes( {
				...attributes,
				seo: initialVideoData,
			} );

			hasInitialized.current = true;
		}
	}, [ attachmentData, attributes, setAttributes ] );

	useEffect( () => {
		if ( duration ) {
			setVideoData( { ...videoData, duration } );
		}
	}, [ duration ] );

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
