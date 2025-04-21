/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { ToggleControl, Button, Notice, Panel, PanelBody } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * Internal dependencies
 */
import ColorPickerButton from '../video-editor/components/ColorPickerButton';
import { useEffect } from 'react';

const GeneralSettings = ( { mediaSettings, saveMediaSettings } ) => {
	const [ selectedBrandImage, setSelectedBrandImage ] = useState( mediaSettings?.general?.selected_brand_image || '' );
	const [ disableFolderOrganization, setdisableFolderOrganization ] = useState( mediaSettings?.general?.disable_folder_organization || false );
	const [ brandColor, setBrandColor ] = useState( mediaSettings?.general?.brand_color || '#000000' );

	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const loading = useSelector( ( state ) => state.storage.loading );

	useEffect( () => {
		if ( ! mediaSettings?.general ) {
			return;
		}

		const { selected_brand_image = '', disable_folder_organization = false, brand_color = '#000000' } = mediaSettings.general;

		setSelectedBrandImage( selected_brand_image );
		setdisableFolderOrganization( disable_folder_organization );
		setBrandColor( brand_color );
	}, [ mediaSettings ] );

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

			setSelectedBrandImage( attachment.url );
		} );

		fileFrame.open();
	};

	const removeBrandImage = () => {
		setSelectedBrandImage( '' );
	};

	const handleSaveSettings = async () => {
		const updatedSettings = {
			...mediaSettings,
			general: {
				disable_folder_organization: disableFolderOrganization,
				selected_brand_image: selectedBrandImage,
				brand_color: brandColor,
			},
		};

		const isSaved = await saveMediaSettings( updatedSettings );

		if ( isSaved ) {
			setNotice( {
				message: __( 'Settings saved successfully.', 'godam' ),
				status: 'success',
				isVisible: true,
			} );
		} else {
			setNotice( {
				message: __( 'Failed to save settings. Please try again.', 'godam' ),
				status: 'error',
				isVisible: true,
			} );
		}

		window.scrollTo( { top: 0, behavior: 'smooth' } );
		// Hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	if ( loading ) {
		// Skeleton loader when data is loading
		return (
			<div id="main-content" className="w-full p-5 bg-white">
				<div className="loading-skeleton flex flex-col gap-4">
					<div className="skeleton-container skeleton-container-short">
						<div className="skeleton-header w-1/2"></div>
					</div>
					<div className="skeleton-container">
						<div className="skeleton-line w-3/4"></div>
						<div className="skeleton-line short w-1/2"></div>
					</div>
					<div className="flex gap-2">
						<div className="skeleton-button w-32 h-10"></div>
						<div className="skeleton-button w-40 h-10"></div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div>

			{ notice?.isVisible && (
				<Notice
					className="mb-2"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }

			<div>
				<Panel
					header={ __( 'General Settings', 'godam' ) }
				>
					<PanelBody
						opened={ true }
					>
						<div className="flex flex-col gap-4">
							<ToggleControl
								__nextHasNoMarginBottom
								className="mb-4"
								label={ __( 'Disable Folder Organization in Media Library', 'godam' ) }
								help={ __( 'Enable this option to disable folder organization in the media library.', 'godam' ) }
								checked={ disableFolderOrganization }
								onChange={ ( value ) => setdisableFolderOrganization( value ) }
							/>
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
									{ selectedBrandImage ? 'Replace' : 'Upload' }
								</Button>
								{ selectedBrandImage && (
									<Button onClick={ removeBrandImage } variant="secondary" isDestructive>
										{ __( 'Remove', 'godam' ) }
									</Button>
								) }
								{ selectedBrandImage && (
									<div className="mt-2">
										<img
											src={ selectedBrandImage }
											alt={ 'Selected custom brand' }
											className="max-w-[200px]"
										/>
									</div>
								) }

								<p className="text-xsm text-gray-600 mb-2">
									{ __( 'Upload a custom brand logo to display beside the player controls when selected. This can be overridden for individual videos', 'godam' ) }
								</p>
							</div>

							<div className="form-group">

								<label
									htmlFor="brand-color"
									className="easydam-label"
								>
									{ __( 'Brand Color', 'godam' ) }
								</label>

								<ColorPickerButton
									label={ __( 'Brand Color', 'godam' ) }
									value={ brandColor }
									onChange={ ( color ) => setBrandColor( color ) }
								/>

								<p className="text-xsm text-gray-600 mb-2">
									{ __( 'Select a brand color to apply to the video block. This can be overridden for individual videos by the video editor', 'godam' ) }
								</p>
							</div>
						</div>
					</PanelBody>
				</Panel>
			</div>

			<Button
				variant="primary"
				className="mt-4 max-w-[140px] w-full flex justify-center items-center"
				onClick={ handleSaveSettings }
			>
				{ __( 'Save Settings', 'godam' ) }
			</Button>

		</div>
	);
};

export default GeneralSettings;
