/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const BrandImageSelector = ( { mediaSettings, handleSettingChange } ) => {
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
