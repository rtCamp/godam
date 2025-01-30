/**
 * WordPress dependencies
 */
import { ToggleControl, SelectControl, Button, Notice, Panel, PanelBody } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const ImageSettings = ( { mediaSettings, saveMediaSettings } ) => {
	const [ syncFromEasyDAM, setSyncFromEasyDAM ] = useState( mediaSettings?.image?.sync_from_easydam || false );
	const [ optimizeImages, setOptimizeImages ] = useState( mediaSettings?.image?.optimize_images || false );
	const [ imageFormat, setImageFormat ] = useState( mediaSettings?.image?.image_format || 'auto' );
	const [ imageQuality, setImageQuality ] = useState( mediaSettings?.image?.image_quality || '20' );

	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const imageFormatOptions = [
		{ label: 'Not set', value: 'not-set' },
		{ label: 'Auto', value: 'auto' },
		{ label: 'PNG', value: 'png' },
		{ label: 'JPG', value: 'jpg' },
		{ label: 'WebP', value: 'webp' },
		{ label: 'AVIF', value: 'avif' },
		{ label: 'GIF', value: 'gif' },
	];

	const imageQualityOptions = [
		{ label: 'Not set', value: 'not-set' },
		{ label: 'Auto', value: 'auto' },
		{ label: 'Auto best', value: 'auto-best' },
		{ label: 'Auto good', value: 'auto-good' },
		{ label: 'Auto eco', value: 'auto-eco' },
		{ label: 'Auto low', value: 'auto-low' },
		{ label: '100', value: '100' },
		{ label: '80', value: '80' },
		{ label: '60', value: '60' },
		{ label: '40', value: '40' },
		{ label: '20', value: '20' },
	];

	const handleSaveSettings = async () => {
		const updatedSettings = {
			...mediaSettings, // Preserve other settings
			image: {
				sync_from_easydam: syncFromEasyDAM,
				optimize_images: optimizeImages,
				image_format: imageFormat,
				image_quality: imageQuality,
			},
		};
		saveMediaSettings( updatedSettings ); // Pass updated settings to the parent function

		const isSaved = await saveMediaSettings( updatedSettings ); // Use the updated function

		if ( isSaved ) {
			// Success notice
			setNotice( { message: 'Settings saved successfully!', status: 'success', isVisible: true } );
		} else {
			// Error notice
			setNotice( { message: 'Failed to save settings. Please try again', status: 'error', isVisible: true } );
		}
		window.scrollTo( { top: 0, behavior: 'smooth' } );
		// Hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	return (
		<div>
			{ notice.isVisible && (
				<Notice
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
					className="mb-2"
				>
					{ notice.message }
				</Notice>
			) }
			<Panel
				header={ __( 'Image - Global Settings', 'godam' ) }
			>
				<PanelBody
					opened={ true }
				>
					<form id="easydam-image-settings" className="flex flex-col">
						<div className="flex flex-col">
							<label className="easydam-settings-label" htmlFor="sync_from_easydam">{ __( 'Image delivery', 'godam' ) }</label>
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Sync and deliver images from EasyDAM', 'godam' ) }
								help={ __( 'If you turn this setting off, your images will be delivered from WordPress', 'godam' ) }
								checked={ syncFromEasyDAM }
								onChange={ ( value ) => setSyncFromEasyDAM( value ) }
							/>
						</div>

						<hr />

						<div className="flex flex-col">
							<label className="easydam-settings-label" htmlFor="optimize_image">{ __( 'Image optimization', 'godam' ) }</label>
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Optimize images on my site', 'godam' ) }
								help={ __( 'Images will be delivered using Cloudinary’s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality', 'godam' ) }
								checked={ optimizeImages }
								onChange={ ( value ) => setOptimizeImages( value ) }
							/>
						</div>

						<hr />

						<div className="flex flex-col">
							<label className="easydam-settings-label" htmlFor="image_format">{ __( 'Image format', 'godam' ) }</label>
							<SelectControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								value={ imageFormat }
								options={ imageFormatOptions }
								onChange={ ( value ) => setImageFormat( value ) }
								size="compact"
								className="max-w-[400px] w-full"
								help={ __( 'The image format to use for delivery. Leave as Auto to automatically deliver the most optimal format based on the user\'s browser and device', 'godam' ) }
							/>
						</div>

						<hr />

						<div className="flex flex-col">
							<label className="easydam-settings-label" htmlFor="image_quality">{ __( 'Image quality', 'godam' ) }</label>
							<SelectControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								value={ imageQuality }
								options={ imageQualityOptions }
								onChange={ ( value ) => setImageQuality( value ) }
								size="compact"
								className="max-w-[400px] w-full"
								help={ __( 'Images will be delivered using GoDAM’s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality', 'godam' ) }
							/>
						</div>
					</form>
				</PanelBody>
			</Panel>

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

export default ImageSettings;
