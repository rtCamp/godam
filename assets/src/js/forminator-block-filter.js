/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */

// TODO: Lint this file and optimize the code. Currently quicly picked from other projets and modified to work with Forminator block.


(function (wp) {
	const { createHigherOrderComponent } = wp.compose;
	const { Fragment } = wp.element;
	const { InspectorControls } = wp.blockEditor;
	const { PanelBody, ToggleControl, TextControl, TextareaControl } =
		wp.components;
	const { addFilter } = wp.hooks;
	const { useState, useEffect } = wp.element;
	const { select, dispatch } = wp.data;

	// Filter to add custom controls to the forminator/forms block
	const withGodamRecordControls = createHigherOrderComponent((BlockEdit) => {
		return (props) => {
			// Only add controls to forminator/forms block
			if (props.name !== "forminator/forms") {
				return <BlockEdit {...props} />;
			}

			// Get attributes or set defaults
			const { attributes, setAttributes } = props;
			const formId = attributes.module_id || "";

			// Create state for our controls
			const [addGodamField, setAddGodamField] = useState(false);
			const [fieldRequired, setFieldRequired] = useState(false);
			const [fieldLabel, setFieldLabel] = useState("Record a Video");
			const [fieldDescription, setFieldDescription] = useState(
				"Please record a video for your submission."
			);

			// Check if the form already has a GoDAM record field
			useEffect(() => {
				if (!formId) return;

				// Use wp.apiFetch to check if the form has a GoDAM field
				wp.apiFetch({
					path: `/godam/v1/forminator/check-form-field?form_id=${formId}&field_type=godam_record`,
				})
					.then((response) => {
						if (response && response.has_field) {
							setAddGodamField(true);
						}
					})
					.catch((error) => {
						console.error("Error checking form field:", error);
					});
			}, [formId]);

			// Handle adding/removing GoDAM field
			const handleToggleGodamField = (value) => {
				setAddGodamField(value);

				if (!formId) {
					return;
				}

				if (value) {
					// Add the field
					wp.apiFetch({
						path: "/godam/v1/forminator/add-form-field",
						method: "POST",
						data: {
							form_id: formId,
							field_type: "godam_record",
							field_data: {
								field_label: fieldLabel,
								required: fieldRequired,
								description: fieldDescription,
								godam_file_selectors: [
									"webcam",
									"screen_capture",
									"file_input",
								],
								godam_video_sync: true,
							},
						},
					})
						.then((response) => {
							// Notify success
							dispatch("core/notices").createNotice(
								"success",
								"GoDAM record field added successfully!",
								{ type: "snackbar" }
							);
						})
						.catch((error) => {
							console.error("Error adding field:", error);
							// Notify error
							dispatch("core/notices").createNotice(
								"error",
								"Failed to add GoDAM record field.",
								{ type: "snackbar" }
							);
							setAddGodamField(false);
						});
				} else {
					// Remove the field
					wp.apiFetch({
						path: "/godam/v1/forminator/remove-form-field",
						method: "POST",
						data: {
							form_id: formId,
							field_type: "godam_record",
						},
					})
						.then((response) => {
							// Notify success
							dispatch("core/notices").createNotice(
								"success",
								"GoDAM record field removed successfully!",
								{ type: "snackbar" }
							);
						})
						.catch((error) => {
							console.error("Error removing field:", error);
							// Notify error
							dispatch("core/notices").createNotice(
								"error",
								"Failed to remove GoDAM record field.",
								{ type: "snackbar" }
							);
							setAddGodamField(true);
						});
				}
			};

			// Handle updating field settings
			const updateFieldSettings = () => {
				if (!formId || !addGodamField) {
					return;
				}

				wp.apiFetch({
					path: "/godam/v1/forminator/update-form-field",
					method: "POST",
					data: {
						form_id: formId,
						field_type: "godam_record",
						field_data: {
							field_label: fieldLabel,
							required: fieldRequired,
							description: fieldDescription,
						},
					},
				})
					.then((response) => {
						// Notify success
						dispatch("core/notices").createNotice(
							"success",
							"GoDAM record field updated successfully!",
							{ type: "snackbar" }
						);
					})
					.catch((error) => {
						console.error("Error updating field:", error);
						// Notify error
						dispatch("core/notices").createNotice(
							"error",
							"Failed to update GoDAM record field.",
							{ type: "snackbar" }
						);
					});
			};

			return (
				<Fragment>
					<BlockEdit {...props} />
					<InspectorControls>
						<PanelBody
							title="GoDAM Video Recording"
							initialOpen={false}
							icon="video-alt2"
						>
							{formId ? (
								<>
									<ToggleControl
										label="Add GoDAM Record Field"
										help={
											addGodamField
												? "GoDAM record field will be added to this form"
												: "Add a video recording field to this form"
										}
										checked={addGodamField}
										onChange={handleToggleGodamField}
									/>

									{addGodamField && (
										<>
											<TextControl
												label="Field Label"
												value={fieldLabel}
												onChange={(value) => setFieldLabel(value)}
												onBlur={updateFieldSettings}
											/>

											<TextareaControl
												label="Field Description"
												value={fieldDescription}
												onChange={(value) => setFieldDescription(value)}
												onBlur={updateFieldSettings}
											/>

											<ToggleControl
												label="Required Field"
												checked={fieldRequired}
												onChange={(value) => {
													setFieldRequired(value);
													setTimeout(() => updateFieldSettings(), 100);
												}}
											/>
										</>
									)}
								</>
							) : (
								<p>Please select a form first.</p>
							)}
						</PanelBody>
					</InspectorControls>
				</Fragment>
			);
		};
	}, "withGodamRecordControls");

	// Add the filter
	addFilter(
		"editor.BlockEdit",
		"godam/forminator-godam-record",
		withGodamRecordControls
	);
})(window.wp);
/* eslint-enable */
