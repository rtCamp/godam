/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const BrandImageSelector = ( { mediaSettings, handleSettingChange } ) => {
	const openBrandMediaPicker = () => {
		const fileFrame = wp.media( {
			title: 'Select Brand Image',
			button: {
				text: 'Use this brand image',
			},
			library: {
				type: 'image', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			handleSettingChange( 'brand_image', attachment.url );
		} );

		fileFrame.open();
	};

	const removeBrandImage = () => {
		handleSettingChange( 'brand_image', '' );
	};

	return (
		<div className="godam-form-group godam-margin-bottom">
			<label
				htmlFor="custom-brand-logo"
			>
				{ __( 'Custom brand logo', 'godam' ) }
			</label>

			<Button
				onClick={ openBrandMediaPicker }
				variant="primary"
				className="godam-button godam-margin-right"
			>
				{ mediaSettings?.general?.brand_image ? 'Replace' : 'Upload' }
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
						alt={ 'Selected custom brand' }
						className="max-w-[200px]"
					/>
				</div>
			) }

			<p className="help-text">
				{ __( 'Upload a custom brand logo to display beside the player controls when selected. This can be overridden for individual videos', 'godam' ) }
			</p>
		</div>
	);
};

export default BrandImageSelector;
