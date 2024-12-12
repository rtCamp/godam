/**
 * WordPress dependencies
 */
import { ToggleControl, SelectControl } from '@wordpress/components';
import { useState } from '@wordpress/element';

const ImageSettings = () => {
	const [ syncFromEasyDAM, setSyncFromEasyDAM ] = useState( false );
	const [ optimizeImages, setOptimizeImages ] = useState( false );
	const [ imageFormat, setImageFormat ] = useState( { value: '', name: 'Not set' } );
	const [ imageQuality, setImageQuality ] = useState( { value: '', name: 'Not set' } );

	const imageFormatOptions = [
		{ label: 'Not set', value: '' },
		{ label: 'Auto', value: 'auto' },
		{ label: 'PNG', value: 'png' },
		{ label: 'JPG', value: 'jpg' },
		{ label: 'WebP', value: 'webp' },
		{ label: 'AVIF', value: 'avif' },
		{ label: 'GIF', value: 'gif' },
	];

	const imageQualityOptions = [
		{ label: 'Not set', value: '' },
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

	return (
		<div>
			<h2 className="py-2 border-b text-xl font-bold">Image - Global Settings</h2>

			<form id="easydam-video-settings" className="flex flex-col">
				<div className="py-3 flex flex-col gap-2">
					<label className="block text-base font-semibold" htmlFor="sync_from_easydam">Image delivery</label>
					<ToggleControl
						__nextHasNoMarginBottom
						label="Sync and deliver images from EasyDAM."
						checked={ syncFromEasyDAM }
						onChange={ ( value ) => setSyncFromEasyDAM( value ) }
					/>
					<div className="text-slate-500">If you turn this setting off, your images will be delivered from WordPress.</div>
				</div>

				<hr />

				<div className="pt-3 flex flex-col gap-1">
					<label className="block text-base font-semibold" htmlFor="optimize_image">Image optimization</label>
					<ToggleControl
						__nextHasNoMarginBottom
						label="Optimize images on my site."
						checked={ optimizeImages }
						onChange={ ( value ) => setOptimizeImages( value ) }
					/>
					<div className="text-slate-500">Images will be delivered using Cloudinary’s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality.</div>
				</div>

				<div className="pt-3 flex flex-col gap-1">
					<label className="block text-base font-semibold" htmlFor="image_format">Image format</label>

					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						value={ imageFormat.value }
						options={ imageFormatOptions }
						onChange={ ( value ) =>
							setImageFormat( imageFormatOptions.find( ( option ) => option.value === value ) )
						}
					/>

					<div className="text-slate-500">The image format to use for delivery. Leave as Auto to automatically deliver the most optimal format based on the user's browser and device.</div>
				</div>

				<div className="pt-3 flex flex-col gap-1">
					<label className="block text-base font-semibold" htmlFor="image_quality">Video quality</label>

					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						value={ imageQuality.value }
						options={ imageQualityOptions }
						onChange={ ( value ) =>
							setImageQuality( imageQualityOptions.find( ( option ) => option.value === value ) )
						}
					/>

					<div className="text-slate-500">Videos will be delivered using EasyDAM’s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality.</div>
				</div>
			</form>
		</div>
	);
};

export default ImageSettings;
