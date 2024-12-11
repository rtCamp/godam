const VideoSettings = () => {
	return (
		<div>
			<h2 className="py-2 border-b text-xl font-bold">Video - Global Settings</h2>

			<form id="easydam-video-settings" className="flex flex-col">
				<div className="py-3 flex flex-col gap-2">
					<label className="block text-base font-semibold" htmlFor="sync_from_easydam">Video delivery</label>
					<label className="font-semibold text-[14px] text-base" htmlFor="sync_from_easydam">
						<input id="sync_from_easydam" type="checkbox" name="sync_from_easydam" value="direct" />
						Sync and deliver videos from EasyDAM.
					</label>
					<div className="text-slate-500">If you turn this setting off, your videos will be delivered from WordPress.</div>
				</div>

				<hr />

				<div className="py-3 flex flex-col gap-2">
					<label className="block text-base font-semibold" htmlFor="abs">Adaptive Bitrate Streaming</label>
					<label className="font-semibold text-[14px] text-base" htmlFor="abs">
						<input id="abs" type="checkbox" name="abs" value="direct" />
						Enable Adaptive Bitrate Streaming.
					</label>
					<div className="text-slate-500">If enabled, Transcoder will generate multiple video files with different bitrates for adaptive streaming. This feature is only available for paid subscriptions.</div>
				</div>

				<hr />

				<div>
					<div className="py-3 flex flex-col gap-1">
						<label className="block text-base font-semibold" htmlFor="optimize_video">Video optimization</label>
						<label className="font-semibold text-[14px]" htmlFor="optimize_video">
							<input className="mr-4" id="optimize_video" type="checkbox" name="optimize_video" value="direct" />
							Optimize videos on my site.
						</label>
						<div className="text-slate-500">Videos will be delivered using EasyDAM’s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality.</div>
					</div>

					<div className="flex flex-col gap-1">
						<label className="block text-base font-semibold" htmlFor="video_format">Video format</label>

						<select
							className="form-select form-select-lg"
							name="video_format"
							id="video_format"
						>
							<option>Not set</option>
							<option selected value="auto">Auto</option>
						</select>

						<div className="text-slate-500">The video format to use for delivery. Leave as Auto to automatically deliver the most optimal format based on the user's browser and device..</div>
					</div>

					<div className="py-3 flex flex-col gap-1">
						<label className="block text-base font-semibold" htmlFor="video_quality">Video quality</label>

						<select
							className="form-select form-select-lg"
							name="video_quality"
							id="video_quality"
						>
							<option>Not set</option>
							<option selected value="auto">Auto</option>
							<option selected value="auto-best">Auto best</option>
							<option selected value="auto-good">Auto good</option>
							<option selected value="auto-eco">Auto eco</option>
							<option selected value="auto-low">Auto low</option>
							<option selected value="100">100</option>
							<option selected value="80">80</option>
							<option selected value="60">60</option>
							<option selected value="40">40</option>
							<option selected value="20">20</option>
						</select>

						<div className="text-slate-500">Videos will be delivered using EasyDAM’s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality.</div>
					</div>
				</div>

				<hr />

				<div className="py-3 flex flex-col gap-2 opacity-90 relative px-3 mt-3">
					<div className="absolute bg-orange-400 bg-opacity-10 inset-0 rounded-lg border border-orange-200">
						<button className="px-3 py-2 rounded font-semibold border border-orange-300 bg-orange-200 border-500 absolute top-0 right-0">Premium feature</button>
					</div>
					<label className="block text-base font-semibold" htmlFor="abs">Watermark</label>
					<label className="font-semibold text-[14px] text-base" htmlFor="video_watermark">
						<input id="video_watermark" type="checkbox" name="video_watermark" checked />
						Disable video watermark
					</label>
					<div className="text-slate-500">If enabled, Transcoder will add a watermark to the transcoded video. This feature is only available for paid subscriptions.</div>
				</div>

			</form>
		</div>
	);
};

export default VideoSettings;
