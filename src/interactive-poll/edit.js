/**
 * Retrieves the translation of text.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-i18n/
 */
import { __ } from '@wordpress/i18n';

/**
 * React hook that is used to mark the block wrapper element.
 * It provides all the necessary props like the class name.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
 */
import { InspectorControls, useBlockProps, MediaUpload } from '@wordpress/block-editor';
import {Button, TextControl, DateTimePicker, PanelBody } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';

/**
 * Lets webpack process CSS, SASS or SCSS files referenced in JavaScript files.
 * Those files can contain any CSS code that gets applied to the editor.
 *
 * @see https://www.npmjs.com/package/@wordpress/scripts#using-css
 */
import './editor.scss';
/**
 * The edit function describes the structure of your block in the context of the
 * editor. This represents what the editor will render when the block is used.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#edit
 *
 * @return {Element} Element to render.
 */
const Edit = ({ attributes, setAttributes }) => {
	const { question, options, pollId } = attributes;
	const [errors, setErrors] = useState({ question: false, options: [] });

	//Creating a unique poll ID
	useEffect(() => {
		if (!pollId) {
			setAttributes({ pollId: `poll-${Date.now()}` });
		}
	}, []);

	//Validating empty questions and options to dispaly proper warning
	useEffect(() => {
		const newErrors = {
			question: !question.trim(),
			options: options.map(option =>
				!option.text.trim()
			)
		};
		//console.log(newErrors);
		setErrors(newErrors);
	}, [question, options]);

	const addOption = () => {
		if (options.length <= 5) {
			setAttributes({ options: [...options, { text: '', imageId: null, imageUrl: '' }] });
		}
	};

	const updateOption = (index, field, value) => {
		const newOptions = [...options];
		newOptions[index][field] = value;
		setAttributes({ options: newOptions });
	};

	const removeOption = (index) => {
		if (options.length > 2) {
			setAttributes({ options: options.filter((_, i) => i !== index) });
		}
	};

	const now = Date.now();
	const expirationDate = new Date(attributes.expiration).getTime();
	const timeLeft = expirationDate - now;

	return (
		<div {...useBlockProps()}>
			{/* Preview in main editor area */}
			<div className="interactive-poll">
				{attributes.expiration && (
					<div className="poll-expiration">
						{timeLeft <= 0 ? (
							<span>Poll closed • Final results</span>
						) : (
							<span>
							  Voting open until: {new Date(attributes.expiration).toLocaleString()}
							</span>
						)}
					</div>
				)}
				<h3>{question || __("Poll Question", "interactive-poll")}</h3>
				<div className="poll-options">
					{options.map((option, index) => (
						<div key={index} className="preview-option">
							{option.imageUrl ? (
								<div>
									<img src={option.imageUrl} alt={option.text}/>
									<span>{option.text || __("Option", "interactive-poll")}</span>
								</div>
							) : (
								<span>{option.text || __("Option", "interactive-poll")}</span>
							)}
						</div>
					))}
				</div>
			</div>

			{/* Sidebar controls */}
			<InspectorControls>
				<PanelBody title={__("Poll Settings", "interactive-poll")} initialOpen={true}>
					<TextControl
						label={__("Question *", "interactive-poll")}
						value={question}
						onChange={(val) => setAttributes({ question: val })}
						className={errors.question ? 'has-error' : ''}
					/>
					{errors.question && (
						<p className="error-message">
							{__("Poll question is required", "interactive-poll")}
						</p>
					)}

					<DateTimePicker
						currentDate={attributes.expiration || ''}
						onChange={(newDate) => setAttributes({ expiration: newDate })}
						is12Hour={true}
						label={__("Expiration Date", "interactive-poll")}
					/>
				</PanelBody>

				<PanelBody title={__("Poll Options", "interactive-poll")} initialOpen={true}>
					{options.length < 2 && (
						<p className="error-message">
							{__("Minimum 2 options required", "interactive-poll")}
						</p>
					)}

					{options.map((option, index) => {
						const isInvalid = errors.options[index];
						return (
							<div key={index} className={`option-control ${isInvalid ? 'has-error' : ''}`}>
								<TextControl
									label={__(`Option ${index + 1}`, "interactive-poll")}
									value={option.text}
									onChange={(val) => updateOption(index, 'text', val)}
									className={isInvalid ? 'has-error' : ''}
								/>

								<MediaUpload
									onSelect={(media) => {
										updateOption(index, 'imageId', media.id);
										updateOption(index, 'imageUrl', media.url);
									}}
									allowedTypes={['image']}
									value={option.imageId}
									render={({ open }) => (
										<div className="media-upload-wrapper">
											<Button
												onClick={open}
												variant="secondary"
												className={isInvalid ? 'has-error' : ''}
											>
												{option.imageUrl ?
													__('Replace Image', 'interactive-poll') :
													__('Add Image', 'interactive-poll')}
											</Button>
											{isInvalid && (
												<p className="error-message">
													{__("Text or image required", "interactive-poll")}
												</p>
											)}
										</div>
									)}
								/>

								{options.length > 2 && (
									<Button
										isDestructive
										onClick={() => removeOption(index)}
										disabled={options.length <= 2}
									>
										{__('Remove', 'interactive-poll')}
									</Button>
								)}
							</div>
						);
					})}

					{options.length < 5 && (
						<Button
							variant="primary"
							onClick={addOption}
							className="add-option-button"
						>
							{__('Add Option', 'interactive-poll')}
						</Button>
					)}
				</PanelBody>
			</InspectorControls>
		</div>
	);
};

export default Edit;
