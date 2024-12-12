/**
 * WordPress dependencies
 */
import { ToggleControl, SelectControl, Modal, Button } from '@wordpress/components';
import { useState } from '@wordpress/element';

const VideoSettings = ( { isPremiumUser } ) => {
	const [ syncFromEasyDAM, setSyncFromEasyDAM ] = useState( false );
	const [ videoFormat, setVideoFormat ] = useState( 'auto' );
	const [ disableWatermark, setDisableWatermark ] = useState( isPremiumUser );
	const [ adaptiveBitrate, setAdaptiveBitrate ] = useState( false );
	const [ optimizeVideos, setOptimizeVideos ] = useState( false );
	const [ videoQuality, setVideoQuality ] = useState( '20' );
	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ selectedMedia, setSelectedMedia ] = useState( null );

	const videoFormatOptions = [
		{ label: 'Not set', value: '' },
		{ label: 'Auto', value: 'auto' },
	];

	const videoQualityOptions = [
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

	const handleSubmit = ( e ) => {
		e.preventDefault();
	};

	// Function to handle opening the modal
	const handleOpenModal = () => {
		setIsModalOpen( true );
	};

	// Function to handle closing the modal
	const handleCloseModal = () => {
		setIsModalOpen( false );
	};

	const openMediaPicker = () => {
		const fileFrame = wp.media( {
			title: 'Select a Watermark',
			button: {
				text: 'Use this watermark',
			},
			library: {
				type: 'image', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();
			setSelectedMedia( attachment ); // Save the selected media
			console.log( 'Selected media:', attachment );
		} );

		fileFrame.open();
	};

	return (
		<div>
			<h2 className="py-2 border-b text-xl font-bold">Video - Global Settings</h2>

			<form id="easydam-video-settings" className="flex flex-col" onSubmit={ handleSubmit }>
				<div className="py-3 flex flex-col gap-2">
					<label className="block text-base font-semibold" htmlFor="sync_from_easydam">Video delivery</label>
					<ToggleControl
						__nextHasNoMarginBottom
						label="Sync and deliver videos from EasyDAM."
						checked={ syncFromEasyDAM }
						onChange={ ( value ) => setSyncFromEasyDAM( value ) }
					/>
					<div className="text-slate-500">If you turn this setting off, your videos will be delivered from WordPress.</div>
				</div>

				<hr />

				<div className="py-3 flex flex-col gap-2">
					<label className="block text-base font-semibold" htmlFor="abs">Adaptive Bitrate Streaming</label>
					<ToggleControl
						__nextHasNoMarginBottom
						label="Enable Adaptive Bitrate Streaming."
						checked={ adaptiveBitrate }
						onChange={ ( value ) => setAdaptiveBitrate( value ) }
					/>
					<div className="text-slate-500">If enabled, Transcoder will generate multiple video files with different bitrates for adaptive streaming. This feature is only available for paid subscriptions.</div>
				</div>

				<hr />

				<div>
					<div className="py-3 flex flex-col gap-1">
						<label className="block text-base font-semibold" htmlFor="optimize_video">Video optimization</label>
						<ToggleControl
							__nextHasNoMarginBottom
							label="Optimize videos on my site."
							checked={ optimizeVideos }
							onChange={ ( value ) => setOptimizeVideos( value ) }
						/>
						<div className="text-slate-500">Videos will be delivered using EasyDAM’s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality.</div>
					</div>

					<div className="flex flex-col gap-1">
						<label className="block text-base font-semibold" htmlFor="video_format">Video format</label>
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							value={ videoFormat }
							options={ videoFormatOptions }
							onChange={ ( { selectedItem } ) => setVideoFormat( selectedItem ) }
							describedBy="The video format to use for delivery"
							showSelectedHint
							size="compact"
							className="max-w-[400px] w-full"
						/>
						<div className="text-slate-500">The video format to use for delivery. Leave as Auto to automatically deliver the most optimal format based on the user's browser and device..</div>
					</div>

					<div className="py-3 flex flex-col gap-1">
						<label className="block text-base font-semibold" htmlFor="video_quality">Video quality</label>
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							value={ videoQuality }
							options={ videoQualityOptions }
							onChange={ ( { selectedItem } ) => setVideoQuality( selectedItem ) }
							describedBy="The quality of the video for delivery."
							showSelectedHint
							size="compact"
							className="max-w-[400px] w-full"
						/>
						<div className="text-slate-500">Videos will be delivered using EasyDAM’s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality.</div>
					</div>
				</div>

				<hr />

				<div className="py-3 flex flex-col gap-2 opacity-90 relative px-3 mt-3">
					{ ! isPremiumUser && (
						<div className="absolute bg-orange-400 bg-opacity-10 inset-0 rounded-lg border border-orange-200">
							<button
								type="button"
								className="px-3 py-2 rounded font-semibold border border-orange-300 bg-orange-200 border-500 absolute top-0 right-0"
								onClick={ handleOpenModal }
							>
								Premium feature
							</button>
						</div>
					) }
					<label className="block text-base font-semibold" htmlFor="abs">Watermark</label>
					<ToggleControl
						__nextHasNoMarginBottom
						label="Disable video watermark"
						checked={ disableWatermark }
						onChange={ ( value ) => setDisableWatermark( value ) }
						disabled={ ! isPremiumUser }
					/>
					{ isPremiumUser && ! disableWatermark && (
						<div className="mt-4">
							<Button isPrimary onClick={ openMediaPicker }>
								{ selectedMedia ? 'Change Watermark' : 'Select Watermark' }
							</Button>
							{ selectedMedia && (
								<div className="mt-2">
									<img
										src={ selectedMedia.url }
										alt={ selectedMedia.alt || 'Selected watermark' }
										className="max-w-[200px]"
									/>
								</div>
							) }
						</div>
					) }
					<div className="text-slate-500">If enabled, Transcoder will add a watermark to the transcoded video. This feature is only available for paid subscriptions.</div>
				</div>
				{ isModalOpen && (
					<Modal
						title="Upgrade to Premium"
						onRequestClose={ handleCloseModal }
					>
						<p className="text-base text-gray-700">
							To access this feature, please upgrade to our premium subscription plan.
						</p>
						<Button
							isPrimary
							className="mt-4"
						>
							Go to Payment Page
						</Button>
					</Modal>
				) }
			</form>
		</div>
	);
};

export default VideoSettings;
