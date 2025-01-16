/**
 * WordPress dependencies
 */
import { ToggleControl, TextControl, SelectControl, Modal, Button, Notice, CheckboxControl } from '@wordpress/components';
import { useState } from '@wordpress/element';

const VideoSettings = ( { isPremiumUser, mediaSettings, saveMediaSettings } ) => {
	const [ syncFromEasyDAM, setSyncFromEasyDAM ] = useState( mediaSettings?.video?.sync_from_easydam || false );
	const [ videoFormat, setVideoFormat ] = useState( mediaSettings?.video?.video_format || 'auto' );
	const [ disableWatermark, setDisableWatermark ] = useState( mediaSettings?.video?.watermark !== undefined ? ! mediaSettings.video.watermark : true );
	const [ adaptiveBitrate, setAdaptiveBitrate ] = useState( mediaSettings?.video?.adaptive_bitrate || false );
	const [ optimizeVideos, setOptimizeVideos ] = useState( mediaSettings?.video?.optimize_videos || false );
	const [ videoQuality, setVideoQuality ] = useState( mediaSettings?.video?.video_quality || [] );
	const [ videoThumbnails, setVideoThumbnails ] = useState( mediaSettings?.video?.video_thumbnails || 5 );
	const [ overwriteThumbnails, setOverwriteThumbnails ] = useState( mediaSettings?.video?.overwrite_thumbnails || false );
	const [ watermarkText, setWatermarkText ] = useState( mediaSettings?.video?.watermark_text || '' );

	const [ selectedMedia, setSelectedMedia ] = useState( { url: mediaSettings?.video?.watermark_url } );
	const [ useImage, setUseImage ] = useState( mediaSettings?.video?.use_watermark_image || false );

	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const videoFormatOptions = [
		{ label: 'Not set', value: 'not-set' },
		{ label: 'Auto', value: 'auto' },
	];

	const videoQualityOptions = [
		{ label: 'Auto', value: 'auto' },
		{ label: '240p (352 x 240)', value: '240p' },
		{ label: '360p (640 x 360)', value: '360p' },
		{ label: '480p (842 x 480)', value: '480p' },
		{ label: '720p (1280 x 720)', value: '720p' },
		{ label: '1080p (1920 x 1080) (HD)', value: '1080p' },
		{ label: '1440p (2560 x 1440) (HD)', value: '1440p' },
		{ label: '2160p (3840 x 2160) (4K)', value: '2160p' },
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
			if ( attachment.type === 'image' ) {
				setSelectedMedia( { url: attachment.url } );
			} else {
				// Show a notice for invalid selection
				setNotice( { message: 'Please select a valid image file.', status: 'error', isVisible: true } );
				window.scrollTo( { top: 0, behavior: 'smooth' } );
				setTimeout( () => {
					setNotice( { message: '', status: '', isVisible: false } );
				}, 5000 );
			}
		} );

		fileFrame.open();
	};

	const handleSaveSettings = async () => {
		const updatedSettings = {
			...mediaSettings,
			video: {
				sync_from_easydam: syncFromEasyDAM,
				video_format: videoFormat,
				adaptive_bitrate: adaptiveBitrate,
				optimize_videos: optimizeVideos,
				video_quality: videoQuality,
				video_thumbnails: videoThumbnails,
				overwrite_thumbnails: overwriteThumbnails,
				watermark: ! disableWatermark,
				use_watermark_image: useImage,
				watermark_url: selectedMedia?.url || '',
				watermark_text: watermarkText || '',
			},
		};

		const isSaved = await saveMediaSettings( updatedSettings );

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
			<h2 className="py-2 border-b text-xl font-bold">Video - Global Settings</h2>

			{ notice?.isVisible && (
				<Notice
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }

			<form id="easydam-video-settings" className="flex flex-col" onSubmit={ handleSubmit }>
				{ /* <div className="py-3 flex flex-col gap-2">
					<label className="block text-base font-semibold" htmlFor="sync_from_easydam">Video delivery</label>
					<ToggleControl
						__nextHasNoMarginBottom
						label="Sync and deliver videos from EasyDAM"
						checked={ syncFromEasyDAM }
						onChange={ ( value ) => setSyncFromEasyDAM( value ) }
					/>
					<div className="text-slate-500">If you turn this setting off, your videos will be delivered from WordPress</div>
				</div>

				 */ }

				<div className="py-3 flex flex-col gap-2">
					<label className="block text-base font-semibold" htmlFor="abs">Adaptive Bitrate Streaming</label>
					<ToggleControl
						__nextHasNoMarginBottom
						label="Enable Adaptive Bitrate Streaming"
						checked={ adaptiveBitrate }
						onChange={ ( value ) => setAdaptiveBitrate( value ) }
					/>
					<div className="text-slate-500">If enabled, Transcoder will generate multiple video files with different bitrates for adaptive streaming</div>
				</div>

				<div>
					{ /*
					<div className="py-3 flex flex-col gap-1">
						<label className="block text-base font-semibold" htmlFor="optimize_video">Video optimization</label>
						<ToggleControl
							__nextHasNoMarginBottom
							label="Optimize videos on my site"
							checked={ optimizeVideos }
							onChange={ ( value ) => setOptimizeVideos( value ) }
						/>
						<div className="text-slate-500">Videos will be delivered using EasyDAM’s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality</div>
					</div>

					<div className="flex flex-col gap-1">
						<label className="block text-base font-semibold" htmlFor="video_format">Video format</label>
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							value={ videoFormat }
							options={ videoFormatOptions }
							onChange={ ( value ) => setVideoFormat( value ) }
							describedBy="The video format to use for delivery"
							showSelectedHint
							size="compact"
							className="max-w-[400px] w-full"
						/>
						<div className="text-slate-500">The video format to use for delivery. Leave as Auto to automatically deliver the most optimal format based on the user's browser and device</div>
					</div>
					*/ }
					<div className="py-3 flex flex-col gap-1">
						<label className="block text-base font-semibold" htmlFor="video_quality">Video quality</label>
						<div className="grid grid-rows-4 grid-flow-col gap-2 border rounded p-5 h-[250px]">
							{ videoQualityOptions.map( ( option ) => (
								<div key={ option.value } className="py-1 w-fit">
									<CheckboxControl
										label={ option.label }
										checked={ videoQuality.includes( option.value ) }
										onChange={ ( isChecked ) => {
											setVideoQuality( ( prev ) => {
												if ( option.value === 'auto' ) {
													// If "Auto" is toggled on, select all options
													return isChecked ? videoQualityOptions.map( ( opt ) => opt.value ) : prev.filter( ( val ) => val !== 'auto' );
												}
												// Update other options
												const updated = isChecked
													? [ ...prev, option.value ]
													: prev.filter( ( val ) => val !== option.value );

												// Automatically toggle "Auto" based on selection of all other options
												const allOthersSelected = videoQualityOptions
													.filter( ( opt ) => opt.value !== 'auto' ) // Exclude "auto"
													.every( ( opt ) => updated.includes( opt.value ) );

												// Add "Auto" if all other options are selected, remove otherwise
												return allOthersSelected
													? [ 'auto', ...updated.filter( ( v ) => v !== 'auto' ) ]
													: updated.filter( ( v ) => v !== 'auto' );
											} );
										} }
									/>
								</div>
							) ) }
						</div>
						<div className="text-slate-500">
							Select one or more video qualities for delivery. Transcoder will generate videos with selected resolutions. Transcoding will be done to the appropriate resolution supported by the video, up to the max resolution of each video.
							<strong> Note:</strong> Selecting Auto will automatically include all available resolutions for delivery.
						</div>
					</div>
				</div>

				<div className="py-3 flex flex-col gap-2">
					<label className="block text-base font-semibold" htmlFor="video_thumbnails_count">
						Number of video thumbnails generated
					</label>
					<TextControl
						type="number"
						min="1"
						max="10"
						value={ videoThumbnails }
						onChange={ ( value ) => setVideoThumbnails( value ) }
						className="max-w-[60px]"
					/>
					<div className="text-slate-500">
						This field specifies the number of video thumbnails that will be generated by the Transcoder. To choose
						from the generated thumbnails for a video, go to Media &gt; Edit &gt; Video Thumbnails. Thumbnails are only
						generated when the video is first uploaded. Maximum value is 10
					</div>
				</div>

				<div className="py-3 flex flex-col gap-2">
					<label className="block text-base font-semibold" htmlFor="overwrite_thumbnails">
						Over-write video thumbnails after retranscoding
					</label>
					<ToggleControl
						__nextHasNoMarginBottom
						label="Over-write video thumbnails"
						checked={ overwriteThumbnails }
						onChange={ ( value ) => setOverwriteThumbnails( value ) }
					/>
					<div className="text-slate-500">
						If enabled, Transcoder will replace existing media thumbnails with regenerated ones after retranscoding.
						If disabled, media thumbnails will remain untouched
					</div>
				</div>

				<div className="py-3 flex flex-col gap-2 opacity-90 relative">
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
					<div className="text-slate-500">If enabled, Transcoder will add a watermark to the transcoded video</div>
					{ isPremiumUser && ! disableWatermark && (
						<>
							<div className="mt-4">

								<ToggleControl
									label="Use image watermark"
									checked={ useImage }
									onChange={ ( value ) => {
										setUseImage( value );
									} }
								/>
								<div className="text-slate-500">If enabled, Transcoder will use an image instead of text as the watermark for the transcoded video</div>
								<span className="font-semibold">(Recommended dimensions:</span> 200 px width × 70 px height)
								{ useImage && (
									<div className="mt-2">
										<div className="flex gap-2">
											<Button variant="primary" onClick={ openMediaPicker }>
												{ selectedMedia && selectedMedia.url ? 'Change Watermark' : 'Select Watermark' }
											</Button>
											{ selectedMedia && selectedMedia.url && (
												<Button
													isDestructive
													onClick={ () => setSelectedMedia( null ) }
													variant="secondary"
												>
													Remove Watermark
												</Button>
											) }
										</div>
										{ selectedMedia && selectedMedia.url && (
											<div className="mt-2 border-2 border-blue-700 rounded-lg p-2 inline-block bg-gray-200">
												<img
													src={ selectedMedia.url }
													alt={ selectedMedia.alt || 'Selected watermark' }
													className="max-w-[200px]"
												/>
											</div>
										) }
									</div>
								) }
							</div>
							{ ! useImage && (
								<div className="py-3 flex flex-col gap-2">
									<label className="block text-base font-semibold" htmlFor="watermark_text">Watermark Text</label>
									<TextControl
										__next40pxDefaultSize
										__nextHasNoMarginBottom
										value={ watermarkText }
										onChange={ ( value ) => setWatermarkText( value ) }
										placeholder="Enter watermark text"
										className="max-w-[400px]"
									/>
									<div className="text-slate-500">Specify the watermark text that will be added to transcoded videos</div>
								</div>
							) }
						</>
					) }
				</div>
				{ isModalOpen && (
					<Modal
						title="Upgrade to Premium"
						onRequestClose={ handleCloseModal }
					>
						<p className="text-base text-gray-700">
							To access this feature, please upgrade to our premium subscription plan
						</p>
						<Button
							isPrimary
							className="mt-4"
						>
							Go to Payment Page
						</Button>
					</Modal>
				) }
				<Button
					isPrimary
					className="mt-4 max-w-[140px] w-full flex justify-center items-center"
					onClick={ handleSaveSettings }
				>
					Save Settings
				</Button>
			</form>
		</div>
	);
};

export default VideoSettings;
