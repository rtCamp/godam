/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, SelectControl, RangeControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import './editor.scss';

/**
 * The edit function describes the structure of your block in the context of the
 * editor. This represents what the editor will render when the block is used.
 *
 * @param {Object}   props               Block props.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Function to set block attributes.
 * @return {WPElement} Element to render.
 */
export default function Edit( { attributes, setAttributes } ) {
	const { columns, count, orderby, order } = attributes;
	const blockProps = useBlockProps();

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Gallery Settings', 'godam' ) }>
					<RangeControl
						label={ __( 'Number of columns', 'godam' ) }
						value={ columns }
						onChange={ ( value ) => setAttributes( { columns: value } ) }
						min={ 1 }
						max={ 6 }
					/>
					<RangeControl
						label={ __( 'Number of videos', 'godam' ) }
						value={ count }
						onChange={ ( value ) => setAttributes( { count: value } ) }
						min={ -1 }
						max={ 50 }
						help={ __( 'Set to -1 to show all videos', 'godam' ) }
					/>
					<SelectControl
						label={ __( 'Order by', 'godam' ) }
						value={ orderby }
						options={ [
							{ label: __( 'Date', 'godam' ), value: 'date' },
							{ label: __( 'Title', 'godam' ), value: 'title' },
							{ label: __( 'Random', 'godam' ), value: 'rand' },
						] }
						onChange={ ( value ) => setAttributes( { orderby: value } ) }
					/>
					<SelectControl
						label={ __( 'Order', 'godam' ) }
						value={ order }
						options={ [
							{ label: __( 'Descending', 'godam' ), value: 'DESC' },
							{ label: __( 'Ascending', 'godam' ), value: 'ASC' },
						] }
						onChange={ ( value ) => setAttributes( { order: value } ) }
					/>
				</PanelBody>
			</InspectorControls>
			<div { ...blockProps }>
				{ __( 'GoDAM Video Gallery', 'godam' ) }
			</div>
		</>
	);
}
