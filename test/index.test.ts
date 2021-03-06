import * as os from 'os';
import * as assert from 'assert';
import {
	Position,
	window,
	workspace,
	WorkspaceEdit
} from 'vscode';
import {
	getFixturePath,
	getOptionsForFixture,
	wait
} from './testUtils';

import * as utils from 'vscode-test-utils';

suite('EditorConfig extension', () => {

	suiteTeardown(utils.closeAllFiles);

	test('indent_style = tab; tab_width = n', async () => {
		for (const n of [2, 3, 4]) {
			const options = await getOptionsForFixture([`tab-width-${n}`]);
			assert.strictEqual(
				options.insertSpaces,
				false,
				`editor has insertSpaces: true`
			);
			assert.strictEqual(
				options.tabSize,
				n,
				`editor has a tabSize of ${options.tabSize} instead of ${n}`
			);
		}
	});

	test('indent_style = space; indent_size = n', async () => {
		for (const n of [2, 3, 4]) {
			const options = await getOptionsForFixture([`indent-size-${n}`]);
			assert.strictEqual(
				options.insertSpaces,
				true,
				`editor has insertSpaces: false`
			);
			assert.strictEqual(
				options.tabSize,
				n,
				`editor has a tabSize of ${options.tabSize} instead of ${n}`
			);
		}
	});

	test('subfolder settings', async () => {
		for (const n of [2, 3, 4, 'x']) {
			const options = await getOptionsForFixture(['folder', `tab-width-${n}`]);
			const expectedTabSize = (n === 'x') ? 8 : n;
			assert.strictEqual(
				options.insertSpaces,
				false,
				`editor has insertSpaces: true`
			);
			assert.strictEqual(
				options.tabSize,
				expectedTabSize,
				`editor has a tabSize of ${options.tabSize} instead of ${expectedTabSize}`
			);
		}
	});

	test('insert_final_newline = true', async () => {
		const savedText = await withSetting(
			'insert_final_newline',
			'true'
		).saveText('foo');
		assert.strictEqual(savedText, `foo${os.EOL}`,
			'editor fails to insert final newline on save');
	});

	test('insert_final_newline = false', async () => {
		const savedText = await withSetting(
			'insert_final_newline',
			'false'
		).saveText(`foo${os.EOL}`);
		assert.strictEqual(savedText, `foo`,
			'editor fails to remove final newline/s on save');
	});

	test('trim_trailing_whitespace = true', async () => {
		const savedText = await withSetting(
			'trim_trailing_whitespace',
			'true'
		).saveText('foo  ');
		assert.strictEqual(savedText, 'foo',
			'editor fails to trim trailing whitespace on save');
	});

	test('trim_trailing_whitespace = false', async () => {
		const savedText = await withSetting(
			'trim_trailing_whitespace',
			'false'
		).saveText('foo  ');
		assert.strictEqual(savedText, 'foo  ',
			'editor fails to preserve trailing whitespace on save');
	});

	test('end_of_line = lf', async () => {
		const savedText = await withSetting(
			'end_of_line',
			'lf',
		).saveText('foo\r\nbar');
		assert.strictEqual(savedText, 'foo\nbar',
			'editor fails to convert CRLF line endings into LF on save');
	});

	test('end_of_line = crlf', async () => {
		const savedText = await withSetting(
			'end_of_line',
			'crlf'
		).saveText('foo\nbar');
		assert.strictEqual(savedText, 'foo\r\nbar',
			'editor fails to convert LF line endings into CRLF on save');
	});

	test('end_of_line = preserve', async () => {
		const savedText = await withSetting(
			'end_of_line',
			'preserve',
			{
				contents: '\r\n'
			}
		).saveText('foo\r\nbar');
		assert.strictEqual(savedText, 'foo\r\nbar',
			'editor fails to preserve CRLF line endings on save');
	});

	test('end_of_line = undefined', async () => {
		const savedText = await withSetting(
			'end_of_line',
			'undefined',
			{
				contents: '\r\n'
			}
		).saveText('foo\r\nbar');
		assert.strictEqual(savedText, 'foo\r\nbar',
			'editor fails to preserve CRLF line endings on save');
	});

	test('detect indentation', async () => {
		const options = await getOptionsForFixture([
			'detect-indentation',
			'indent-size-2'
		]);
		const expectedTabSize = 2;
		assert.strictEqual(
			options.tabSize,
			expectedTabSize,
			`editor has a tabSize of ${options.tabSize} instead of ${expectedTabSize}`
		);
		assert.strictEqual(
			options.insertSpaces,
			true,
			`editor has insertSpaces: ${options.insertSpaces}`
		);
	});
});

function withSetting(
	rule: string,
	value: string,
	options: {
		contents?: string;
	} = {}
) {
	return {
		async getText() {
			return (await createDoc(options.contents)).getText();
		},
		saveText(text: string) {
			return new Promise<string>(async resolve => {
				const doc = await createDoc(options.contents);
				workspace.onDidChangeTextDocument(doc.save);
				workspace.onDidSaveTextDocument(savedDoc => {
					assert.strictEqual(savedDoc.isDirty, false, 'dirty saved doc');
					resolve(savedDoc.getText());
				});
				const edit = new WorkspaceEdit();
				edit.insert(doc.uri, new Position(0, 0), text);
				assert.strictEqual(
					await workspace.applyEdit(edit),
					true,
					'editor fails to apply edit'
				);
			});
		}
	};

	async function createDoc(contents?: string) {
		const filename = await utils.createFile(contents || '', getFixturePath([
			rule,
			value,
			'test'
		]));
		const doc = await workspace.openTextDocument(filename);
		await window.showTextDocument(doc);
		await wait(50); // wait for EditorConfig to apply new settings
		return doc;
	}
}
