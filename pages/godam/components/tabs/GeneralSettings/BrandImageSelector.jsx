/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const BrandImageSelector = ( { mediaSettings, updateMediaSettings } ) => {
	const dispatch = useDispatch();

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

			dispatch( updateMediaSettings( {
				category: 'general',
				key: 'brand_image',
				value: attachment.url,
			} ) );
		} );

		fileFrame.open();
	};

	const removeBrandImage = () => {
		dispatch( updateMediaSettings( {
			category: 'general',
			key: 'brand_image',
			value: '',
		} ) );
	};

	return (
		<div className="form-group">
			<label
				htmlFor="custom-brand-logo"
				className="easydam-label"
			>
				{ __( 'Custom Brand Logo', 'godam' ) }
			</label>

			<Button
				onClick={ openBrandMediaPicker }
				variant="primary"
				className="mr-2"
			>
				{ mediaSettings?.general?.brand_image ? 'Replace' : 'Upload' }
			</Button>
			{ mediaSettings?.general?.brand_image && (
				<Button onClick={ removeBrandImage } variant="secondary" isDestructive>
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

			<p className="text-xsm text-gray-600 mb-2">
				{ __( 'Upload a custom brand logo to display beside the player controls when selected. This can be overridden for individual videos', 'godam' ) }
			</p>
		</div>
	);
};

export default BrandImageSelector;
