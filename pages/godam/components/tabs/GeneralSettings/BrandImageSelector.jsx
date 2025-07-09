/**
 * WordPress dependencies
 */
import { Button, Notice } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const BrandImageSelector = ( { mediaSettings, handleSettingChange } ) => {
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

	/**
	 * Function to open the WordPress media picker for selecting a brand image.
	 * It restricts the selection to images only and handles the selection event.
	 *
	 * For the uploader tab of WordPress media library, it checks if the selected file is an image.
	 * If not, it shows an error notice.
	 */
	const openBrandMediaPicker = () => {
		const fileFrame = wp.media( {
			title: __( 'Select Brand Image', 'godam' ),
			button: {
				text: __( 'Use this brand image', 'godam' ),
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

			handleSettingChange( 'brand_image', attachment.url );
			handleSettingChange( 'brand_image_id', attachment.id );
		} );

		if ( mediaSettings?.general?.brand_image_id ) {
			const attachment = wp.media.attachment( mediaSettings.general.brand_image_id );
			attachment.fetch();

			fileFrame.on( 'open', function() {
				const selection = fileFrame.state().get( 'selection' );
				selection.reset();
				selection.add( attachment );
			} );
		}

		fileFrame.open();
	};

	/**
	 * Handles the removal of the brand image.
	 */
	const removeBrandImage = () => {
		handleSettingChange( 'brand_image', '' );
		handleSettingChange( 'brand_image_id', null );
	};

	return (
		<div className="godam-form-group godam-margin-bottom">
			<label
				className="label-text"
				htmlFor="custom-brand-logo"
			>
				{ __( 'Custom brand logo', 'godam' ) }
			</label>

			<Button
				onClick={ openBrandMediaPicker }
				variant="primary"
				disabled={ 'Bubble' === mediaSettings?.video_player?.player_skin }
				className="godam-button godam-margin-right mt-[0.3rem] mb-[0.7rem]"
			>
				{ mediaSettings?.video_player?.brand_image ? __( 'Replace', 'godam' ) : __( 'Upload', 'godam' ) }
			</Button>
			{ mediaSettings?.video_player?.brand_image && (
				<Button
					onClick={ removeBrandImage }
					variant="secondary"
					isDestructive
					className="godam-button ml-3"
					disabled={ 'Bubble' === mediaSettings?.video_player?.player_skin }
				>
					{ __( 'Remove', 'godam' ) }
				</Button>
			) }
			{ mediaSettings?.video_player?.brand_image && 'Bubble' !== mediaSettings?.video_player?.player_skin && (
				<div className="mt-2">
					<img
						src={ mediaSettings?.video_player?.brand_image }
						alt={ __( 'Selected custom brand', 'godam' ) }
						className="max-w-[200px]"
					/>
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

			<p className="text-[0.75rem] leading-[1.2] text-[#777] mt-2">
				{
					'Bubble' === mediaSettings?.video_player?.player_skin ? __(
						'The brand logo will not be applied to the player skin.',
						'godam',
					) : __(
						'Upload a custom brand logo to display beside the player controls when selected. This can be overridden for individual videos',
						'godam',
					)
				}
			</p>
		</div>
	);
};

export default BrandImageSelector;
