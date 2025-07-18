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
	const [ notice, setNotice ] = useState( {
		message: '',
		status: 'success',
		isVisible: false,
	} );

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

			const imageUrl =
		attachment.mime === 'image/gif'
			? attachment.sizes.full.url
			: attachment.url;

			handleSettingChange( 'brand_image', imageUrl );
		} );

		fileFrame.open();
	};

	/**
	 * Handles the removal of the brand image.
	 */
	const removeBrandImage = () => {
		handleSettingChange( 'brand_image', '' );
	};

	return (
		<div className="godam-form-group godam-margin-bottom">
			<label className="label-text" htmlFor="custom-brand-logo">
				{ __( 'Custom brand logo', 'godam' ) }
			</label>

			<Button
				onClick={ openBrandMediaPicker }
				variant="primary"
				className="godam-button godam-margin-right"
			>
				{ mediaSettings?.general?.brand_image
					? __( 'Replace', 'godam' )
					: __( 'Upload', 'godam' ) }
			</Button>
			{ mediaSettings?.general?.brand_image && (
				<Button
					onClick={ removeBrandImage }
					variant="secondary"
					isDestructive
					className="godam-button"
				>
					{ __( 'Remove', 'godam' ) }
				</Button>
			) }
			{ mediaSettings?.general?.brand_image && (
				<div className="mt-2">
					<img
						src={ mediaSettings?.general?.brand_image }
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
			<p className="help-text">
				{ __(
					'Upload a custom brand logo to display beside the player controls when selected. This can be overridden for individual videos',
					'godam',
				) }
			</p>
		</div>
	);
};

export default BrandImageSelector;
