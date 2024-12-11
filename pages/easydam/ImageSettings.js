const ImageSettings = () => {
	return (
		<div>
			<h2 className="py-2 border-b text-xl font-bold">Image - Global Settings</h2>

			<form id="easydam-video-settings" className="flex flex-col">
				<div className="py-3 flex flex-col gap-2">
					<label className="block text-base font-semibold" htmlFor="sync_from_easydam">Image delivery</label>
					<label className="font-semibold text-[14px] text-base" htmlFor="sync_from_easydam">
						<input id="sync_from_easydam" type="checkbox" name="sync_from_easydam" value="direct" />
						Sync and deliver images from EasyDAM.
					</label>
					<div className="text-slate-500">If you turn this setting off, your images will be delivered from WordPress.</div>
				</div>

				<hr />

				<div className="pt-3 flex flex-col gap-1">
					<label className="block text-base font-semibold" htmlFor="optimize_image">Image optimization</label>
					<label className="font-semibold text-[14px]" htmlFor="optimize_image">
						<input className="mr-4" id="optimize_image" type="checkbox" name="optimize_image" value="direct" />
						Optimize images on my site.
					</label>
					<div className="text-slate-500">Images will be delivered using Cloudinary’s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality.</div>
				</div>

				<div className="pt-3 flex flex-col gap-1">
					<label className="block text-base font-semibold" htmlFor="image_format">Image format</label>

					<select
						className="form-select form-select-lg"
						name="image_format"
						id="image_format"
					>
						<option>Not set</option>
						<option selected value="auto">Auto</option>
						<option value="png">PNG</option>
						<option value="jpg">JPG</option>
						<option value="webp">WebP</option>
						<option value="avif">AVIF</option>
						<option value="gif">GIF</option>
					</select>

					<div className="text-slate-500">The image format to use for delivery. Leave as Auto to automatically deliver the most optimal format based on the user's browser and device.</div>
				</div>

				<div className="pt-3 flex flex-col gap-1">
					<label className="block text-base font-semibold" htmlFor="image_quality">Video quality</label>

					<select
						className="form-select form-select-lg"
						name="image_quality"
						id="image_quality"
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
			</form>
		</div>
	);
};

export default ImageSettings;
