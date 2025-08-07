/**
 * WordPress dependencies
 */
import { Button, Notice, Icon } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { error } from '@wordpress/icons';

const BrandImageSelector = ( { mediaSettings, handleSettingChange } ) => {
	/**
	 * State to manage the notice message and visibility.
	 */
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const isBubbleOrClassic = 'Bubble' === mediaSettings?.video_player?.player_skin || 'Classic' === mediaSettings?.video_player?.player_skin;

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

		if ( mediaSettings?.video_player?.brand_image_id ) {
			const attachment = wp.media.attachment( mediaSettings.video_player.brand_image_id );
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
		<div className="godam-form-group">
			<label
				className="label-text"
				htmlFor="custom-brand-logo"
			>
				{ __( 'Custom brand logo', 'godam' ) }
			</label>

			<div className="flex items-center flex-wrap gap-2">
				<Button
					onClick={ openBrandMediaPicker }
					variant="primary"
					disabled={ isBubbleOrClassic }
					className="godam-button"
				>
					{ mediaSettings?.video_player?.brand_image ? __( 'Replace', 'godam' ) : __( 'Upload', 'godam' ) }
				</Button>
				{ mediaSettings?.video_player?.brand_image && (
					<Button
						onClick={ removeBrandImage }
						variant="secondary"
						isDestructive
						className="godam-button"
						disabled={ isBubbleOrClassic }
					>
						{ __( 'Remove', 'godam' ) }
					</Button>
				) }
			</div>

			{ mediaSettings?.video_player?.brand_image && 'Bubble' !== mediaSettings?.video_player?.player_skin && 'Classic' !== mediaSettings?.video_player?.player_skin && (
				<div className="mt-3 border-2 border-indigo-200 rounded-lg p-2 block bg-gray-200 w-fit">
					<img
						src={ mediaSettings?.video_player?.brand_image }
						alt={ __( 'Selected custom brand', 'godam' ) }
						className="max-w-[150px]"
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

			<p className="text-[0.75rem] leading-[1.2] text-[#777]">
				{
					isBubbleOrClassic
						? ( <div className="flex items-center gap-2">
							<Icon icon={ error } style={ { fill: '#EAB308' } } size={ 28 } />
							<p className="text-[#AB3A6C] text-[0.75rem] leading-[1.2]">{ __(
								'The brand logo will not be applied to the player skin.',
								'godam',
							) }
							</p>
						</div>
						) : __( 'Upload a custom brand logo to display beside the player controls when selected. This can be overridden for individual videos', 'godam' )
				}
			</p>
		</div>
	);
};

export default BrandImageSelector;
