
window.onkeyup = function () {

	/*var items = document.querySelectorAll("#invoice_details_table");
	var itemsArray = Array.prototype.slice.call(items, 0);
	var unit, rate, total, net = 0;
	itemsArray.forEach(function (el) {
		unit = el.querySelector('input[name="Quantity"]').value;
		rate = el.querySelector('input[name="UnitPrice"]').value;
		rate = rate.substr(1);
		total = unit * rate;
		net += total;
		total = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2 });
		el.querySelector('input[name="Extension"]').value = total;
		el.querySelector('input[name="ITotal"]').value = net.toLocaleString('en-US', { minimumFractionDigits: 2 });
	});*/
}

function addRow(tableID) {

	var table = document.getElementById(tableID);
	var rowCount = table.rows.length;
	var row = table.insertRow(rowCount - 1);
	var colCount = table.rows[0].cells.length;

	for (var i = 0; i < colCount; i++) {

		var newcell = row.insertCell(i);
		newcell.innerHTML = table.rows[1].cells[i].innerHTML;

		switch (newcell.childNodes[0].type) {
			case "text":
				newcell.childNodes[0].value = "";
				break;
			case "checkbox":
				newcell.childNodes[0].checked = false;
				break;
			case undefined:
				if (newcell.childNodes[0].childNodes[0].type == undefined && newcell.childNodes[0].id == "ItemNumber") {
					newcell.childNodes[0].childNodes[1].defaultValue = "";
					newcell.childNodes[0].childNodes[1].placeholder = "";
				}
				break
		}

		if (newcell.childNodes[0].type != "checkbox" && newcell.childNodes[0].childNodes[0].type == "text") {
			newcell.childNodes[0].childNodes[0].value = "";
			newcell.childNodes[0].childNodes[0].placeholder = "";
		}
	}
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

function addRowToTable(tableID) {

	var tbl = document.getElementById(tableID);
	var lastRow = tbl.rows.length;

	// if there's no header row in the table, then iteration = lastRow + 1
	var iteration = lastRow;
	var row = tbl.insertRow(lastRow - 1);

	// left cell
	var cellLeft = row.insertCell(0);
	var textNode = document.createTextNode(iteration);
	cellLeft.appendChild(textNode);

	var cellRight = row.insertCell(1);
	var el = document.createElement('input');

	el.setAttribute('type', 'text');
	el.setAttribute('id', 'Quantity' + iteration);
	el.setAttribute('size', '22');
	el.onkeyup = function () { store3('Extension' + iteration, 'UnitPrice' + iteration, 'Quantity' + iteration, tableID) }
	cellRight.appendChild(el);

	var cellRight = row.insertCell(1);
	var el = document.createElement('input');
	el.setAttribute('type', 'text');
	el.setAttribute('id', 'UnitPrice' + iteration);
	el.setAttribute('size', '20');
	el.onkeyup = function () { store3('Extension' + iteration, 'UnitPrice' + iteration, 'Quantity' + iteration, tableID) }
	cellRight.appendChild(el);

	var cellRight = row.insertCell(1);
	var el = document.createElement('input');
	el.setAttribute('type', 'text');
	el.setAttribute('id', 'Extension' + iteration);
	el.setAttribute('size', '20');
	el.onkeyup = function () { store3('Extension' + iteration, 'UnitPrice' + iteration, 'Quantity' + iteration, tableID) }
	cellRight.appendChild(el);
}

function store3(t1, t2, t3, tableID) {
	var tbl = document.getElementById(tableID);
	var rowIterator = tbl.rows.length;
	var Ext = document.querySelector('input[name=' + t3 + ']');
	var Qty = document.querySelector('input[name=' + t1 + ']').value;
	var Unit = document.querySelector('input[name=' + t2 + ']').value;
	var Total = (Unit.substring(0, 1) == "$") ? Qty * Unit.substr(1) * 1 : Qty * Unit * 1;
	Ext.value = '$' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 });
}