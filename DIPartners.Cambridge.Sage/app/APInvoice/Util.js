function addRowToTable(tableID) {
	var tbl = document.getElementById(tableID);
	var lastRow = tbl.rows.length;
	var row = tbl.insertRow(lastRow - 1);
	var iteration = lastRow - 2;

	var cellLeft = row.insertCell(0);
	var el = document.createElement('input');
	el.setAttribute('type', 'checkbox');
	el.setAttribute('id', 'chk' + iteration);
	cellLeft.appendChild(el);

	var startCell = iteration / iteration;

	for (var i = iteration; i < iteration + 4; i++) {
		var id = "";
		var cellRight = row.insertCell(startCell);
		var el = document.createElement('input');

		if (startCell == 1) id = "ItemNumber";
		else if (startCell == 2) id = "Quantity";
		else if (startCell == 3) id = "UnitPrice";
		else if (startCell == 4) id = "Extension";

		el.setAttribute('type', 'text');
		el.setAttribute('id', id + iteration);
		if (startCell == 2 || startCell == 3)
			el.onkeyup = function () { Calculate('Quantity' + iteration, 'UnitPrice' + iteration, 'Extension' + iteration, tableID) }
		if (startCell == 4)
			el.setAttribute("readonly", 'true');

		cellRight.appendChild(el);
		startCell++;
	}
}

function Calculate(_qty, _unit, _ext) {
	var Ext = document.getElementById(_ext);
	var Qty = document.getElementById(_qty).value;
	var Unit = document.getElementById(_unit).value;
	var Total = (Unit.substring(0, 1) == "$") ? Qty * Unit.substr(1) * 1 : Qty * Unit * 1;
	Ext.value = '$' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 });

	CalculateTotal();
}

function CalculateTotal() {
	var tbl = document.getElementById('invoice_details_table');
	var lastRow = tbl.rows.length - 2 // header and footer;
	var Ext = 0;
	for (var i = 0; i < lastRow; i++) {
		var currency = document.getElementById('Extension' + i).value;
		Ext += Number(currency.replace(/[^0-9.-]+/g, ""));
	}

	document.getElementById('Total').value = '$' + Ext.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function deleteRow(tableID) {
	try {
		var table = document.getElementById(tableID);
		var rowCount = table.rows.length;

		for (var i = 0; i < rowCount; i++) {
			var row = table.rows[i];
			var chkbox = row.cells[0].childNodes[0];
			if (null != chkbox && true == chkbox.checked) {
				if (rowCount <= 1) {
					alert("Cannot delete all the rows.");
					break;
				}
				table.deleteRow(i);
				rowCount--;
				i--;
			}
		}
	} catch (e) {
		alert(e);
	}
}