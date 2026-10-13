/**
 * Builders for extra rows in an attachment's details sidebar.
 *
 * Private to `attachment-details.js` originally; extracted so the table can be
 * shared by the renderers that add rows to the same sidebar rather than each one
 * starting a table of its own.
 */

/**
 * Creates a table row element representing an attachment field.
 *
 * @param {Object}        params            - The parameters for the field.
 * @param {number|string} params.id         - The attachment ID.
 * @param {string}        params.fieldName  - The name of the field.
 * @param {string}        params.fieldLabel - The label for the field.
 * @param {string}        params.url        - The URL value for the field.
 * @param {string}        params.helpText   - The help text to display under the field.
 * @return {HTMLElement} The constructed table row element.
 */
export const createAttachmentField = ( { id, fieldName, fieldLabel, url, helpText } ) => {
	const tr = document.createElement( 'tr' );
	tr.className = `compat-field-${ fieldName }`;

	const th = document.createElement( 'th' );
	th.scope = 'row';
	th.className = 'label';

	const label = document.createElement( 'label' );
	label.htmlFor = `attachments-${ id }-${ fieldName }`;

	const span = document.createElement( 'span' );
	span.className = 'alignleft';
	span.textContent = fieldLabel;
	label.appendChild( span );

	label.appendChild( document.createElement( 'br' ) );
	label.querySelector( 'br' ).className = 'clear';

	th.appendChild( label );
	tr.appendChild( th );

	const td = document.createElement( 'td' );
	td.className = 'field';

	const input = document.createElement( 'input' );
	input.type = 'text';
	input.className = 'widefat';
	input.name = `attachments[${ id }][${ fieldName }]`;
	input.id = `attachments-${ id }-${ fieldName }`;
	input.value = url;
	input.readOnly = true;
	td.appendChild( input );

	const p = document.createElement( 'p' );
	p.className = 'help';
	p.textContent = helpText;
	td.appendChild( p );

	tr.appendChild( td );

	return tr;
};

/**
 * Gets — or creates — the GoDAM field table inside a details sidebar.
 *
 * Reuses an existing table rather than always appending a new one, because
 * several independent renderers add rows to the same sidebar and each must not
 * start a table of its own.
 *
 * @param {HTMLElement} container - The container element to append the table to.
 * @return {HTMLElement} The table body element (<tbody>).
 */
export const createTable = ( container ) => {
	let table = container.querySelector( ':scope > table.compat-attachment-fields.godam-compat-item' );

	if ( ! table ) {
		table = document.createElement( 'table' );
		table.className = 'compat-attachment-fields compat-item godam-compat-item';
		container.appendChild( table );
	}

	let tableBody = table.querySelector( 'tbody' );

	if ( ! tableBody ) {
		tableBody = document.createElement( 'tbody' );
		table.appendChild( tableBody );
	}

	return tableBody;
};
