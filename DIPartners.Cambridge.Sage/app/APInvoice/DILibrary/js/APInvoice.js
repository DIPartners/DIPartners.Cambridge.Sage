//const { error } = require("jquery");
//const { error } = require("jquery");
var gDashboard;
var gUtil;
var isPopup;
var TaxCode = "";
// Entry point of the dashboard.
function OnNewDashboard(dashboard) {

    isPopup = dashboard.IsPopupDashboard;
    // Parent is a shell pane container (tab), when dashboard is shown in right pane.
    var tab = dashboard.Parent;

    if (isPopup) {
        dashboard.Window.width = 1920;
        dashboard.Window.Height = 880;
    }
    // Initialize console.
    else console.initialize(tab.ShellFrame.ShellUI, "APInvoice");

    gDashboard = dashboard;

    // Some things are ready only after the dashboard has started.
    dashboard.Events.Register(MFiles.Event.Started, OnStarted);
    function OnStarted() {
        SetDetails(dashboard);
    }
}

function SetDetails(dashboard) {
    var Vault = dashboard.Vault;
    var controller = dashboard.CustomData;
    controller.Vault = Vault;
    var editor = controller.Invoice;

    // Apply vertical layout.
    $("body").addClass("mf-layout-vertical");
    ResetTabs();

    // Show some information of the document.
    $('#message_placeholder').text(controller.ObjectVersion.Title + ' (' + controller.ObjectVersion.ObjVer.ID + ')');
    var ObjectVersionProperties = Vault.ObjectPropertyOperations.GetProperties(controller.ObjectVersion.ObjVer);

    gUtil = new APUtil(Vault, controller, editor);

    controller.Invoice = {
        ObjectVersion: controller.ObjectVersion,
        ObjectVersionProperties: ObjectVersionProperties,
        Events: dashboard.Events
    };

    var PONO = ObjectVersionProperties.SearchForPropertyByAlias(dashboard.Vault, "vProperty.POReference", true).Value.DisplayValue;
    if (PONO != "") {
        var ObjectSearchResults = dashboard.Vault.ObjectSearchOperations.SearchForObjectsByConditions(
            FindObjects(dashboard.Vault, 'vOjbect.PurchaseOrder', 'vProperty.PONumber', MFDatatypeText, PONO), MFSearchFlagNone, true);
        if (ObjectSearchResults.Count == 1) {
            var ObjectVersionProperties = Vault.ObjectPropertyOperations.GetProperties(ObjectSearchResults[0].ObjVer);
            TaxCode = gUtil.GetPOTaxCode(PONO);

            controller.PurchaseOrder = {
                ObjectVersion: ObjectSearchResults[0],
                ObjectVersionProperties: ObjectVersionProperties,
                PropertyControls: PropertyControls,
                Events: dashboard.Events
            };
            var editor = controller.PurchaseOrder;
            var PropertyControls = new Array();
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.PONumber'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.Vendor'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.PODate'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.PORequiredDate'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.Currency'));
            editor.PropertyControls = PropertyControls;
        }
    }

    controller.PackingSlip = {
        ObjectVersion: null,
        ObjectVersionProperties: null,
        PropertyControls: null,
        Events: dashboard.Events
    };

    gUtil.ResizeContentArea();
    gUtil.GetGLAccount();
    gUtil.GetTaxDef();
    SetInvoiceDetails(controller);
    SetPODetails(controller);
    SetPSDetails(controller);
    if (!isPopup) CreatePopupIcon();
    $("#rtabs").tabs("option", "active", 0);
    $("#ltabs").tabs("option", "active", 0);
}

function SetInvoiceDetails(controller) {
    var editor = controller.Invoice;
    var Vault = controller.Vault;
    var tabname = 'Invoice';
    var tabdisplayname = tabname;
    var ArrayVal = [];

    CreateMetadataCard(controller, editor, "ltabs", tabname, tabdisplayname);
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.InvoiceNumber')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Date')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Vendor')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.POReference')

    // HKo
    SetInvoicePreview();
    LoadPreview();


    var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
        FindObjects(Vault, 'vObject.InvoiceDetail', 'vProperty.Invoice', MFDatatypeLookup, editor.ObjectVersion.ObjVer.ID), MFSearchFlagNone, true);

    editor.table.append(
        '<tr><td colspan="5" align="center">' +
        '    <table width="90%" id="invoice_details_table" class="details mf-dynamic-table">' +
        '       <tr><th scope="col" width="5%">-</th><th scope="col" width="20%">Item</th><th scope="col" width="10%">Qty</th><th scope="col" width="13%">Unit $</th>' +
        '           <th scope="col" width="15%">Ext $</th><th scope="col" width="8%">TAX<img id="chk" src="DILibrary/images/more_info.png" width="10px" onmouseover="openTaxInform();"><br>Code</th>' +
        '           <th scope="col" width="13%">TAX</th><th scope="col" width="8%">PO#</th><th scope="col" width="15%"><span>GL<br>Account</span></th></tr>' +
        '    </table>' +
        '</td></tr>' +
        '');
    var TableBody = editor.table.find('#invoice_details_table');
    var SearchResultsObjVers = ObjectSearchResults.GetAsObjectVersions().GetAsObjVers();
    var Total = 0, TotalTax = 0, Count = ObjectSearchResults.Count
    const ADJ_EXT = 0;
    const TOTAL_TAX = 1;
    const TAX_CODE = 2;
    const TAX_DESC = 3;
    if (Count > 0) {
        var ObjectSearchResultsProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(SearchResultsObjVers);
        for (var i = 0; i < Count; i++) {
            var props = ObjectSearchResultsProperties[i];
            var Item = props.SearchForPropertyByAlias(Vault, "vProperty.ItemNumber", true).Value.DisplayValue;
            var ItemDesc = props.SearchForPropertyByAlias(Vault, "vProperty.ItemDescription", true).Value.DisplayValue;
            var Qty = props.SearchForPropertyByAlias(Vault, "vProperty.Quantity", true).Value.DisplayValue;
            var Price = props.SearchForPropertyByAlias(Vault, "vProperty.UnitPrice", true).Value.Value;
            //var Amount = props.SearchForPropertyByAlias(Vault, "vProperty.InvoiceLineExtension", true).Value.Value;
            PONumber = props.SearchForPropertyByAlias(Vault, "vProperty.PurchaseOrderDetail", true).Value.DisplayValue;

            var Tax = gUtil.GetTax(Qty, Price, TaxCode);
            var GLAccount = props.SearchForPropertyByAlias(Vault, "vProperty.GLAccount", true).Value.DisplayValue;
            Total = Total + props.SearchForPropertyByAlias(Vault, "vProperty.InvoiceLineExtension", true).Value.Value;
            var curNo = Number(PONumber.split(" - ").pop().trim()) - 1;
            var removeState = (PONumber != "" || Qty == "0") ?
                '   <td scope="row" style="cursor:default;"></td>' :
                '   <td scope="row" style="padding:0px; text-align:center;"><img id="chk" src="DILibrary/images/remove-button-red.png" title="delete item"' +
                '       alt="del" onclick = "gUtil.removeRow(this)"></td> ';

            var htmlStr =
                '<tr>' + removeState +
                '   <td data-label="Item" ><input type="text" class="inputData" id=\'ItemNumber' + i + '\' value="' + Item + '" title="' + ItemDesc + '" ' +
                '       onclick="openForm(' + curNo + ')" > ' +
                '   <input type="hidden" id=\'ItemDescription' + i + '\' value="' + ItemDesc + '" /></td> ' +
                '   <td data-label="Qty"><input type="text" class="inputData" id=\'Quantity' + i + '\' value="' + Qty + '" ' +
                '       onkeyup="gUtil.Calculate(\'' + i + '\')" ' +
                '       onkeypress="return gUtil.isNumberKey(event,this.id)"></td> ' +
                '   <td data-label="Unit $"><input type="text" class="inputData" id=\'UnitPrice' + i + '\' value="' + gUtil.CurrencyFormatter(Price) + '" ' +
                '       onkeyup="gUtil.Calculate(\'' + i + '\')" ' +
                '       onkeypress="return gUtil.isNumberKey(event,this.id)"></td> ' +
                '   <td data-label="Ext $"><input type="text" id=\'InvoiceLineExtension' + i + '\' value="' + gUtil.CurrencyFormatter(Tax[ADJ_EXT]) + '" readonly="true"></td>' +
                '   <td data-label="TAX Code"><input type="text" class="inputData" id=\'TaxCode' + i + '\' value="' + Tax[TAX_CODE] + '" title="' + Tax[TAX_DESC] + '" onblur="gUtil.CheckTaxCode(this.id)"></td>' +
                //'   <td data-label="TAX Code"><select id=\'TaxCode' + i + '\' class="SelectTaxCode">'+gUtil.TaxCodeList+'</select></td>' +
                '   <td data-label="TAX"><input type="text" id=\'Tax' + i + '\' value="' + gUtil.CurrencyFormatter(Tax[TOTAL_TAX]) + '" readonly="true"></td>' +
                '   <td data-label="PO#"><input type="text" class="inputData" id=\'PONumber' + i + '\' ' +
                '       value="' + PONumber.split(" - ").pop().trim() + '" title = "' + PONumber + '"' +
                '       onkeypress="return gUtil.isNumberKey(event,this.id)"></td> ' +
                '   <td data-label="GL Account" ><select id=\"GLAccount' + i + '\" class="SelectGL">' + gUtil.GLAccountList +
                '       </select></td>' +
                '</tr>';
            TotalTax += parseFloat(Tax[TOTAL_TAX]);
            ArrayVal[i] = PONumber + ", " + htmlStr;
        }
        var SortedList = gUtil.SortLineNo(ArrayVal).join();

        TableBody.append(SortedList);

        for (var j = 0; j < ObjectSearchResults.Count; j++) {
            var t = Number($("#PONumber" + j)[0].title.split(" - ").pop().trim()) - 1;
            $("#GLAccount" + t + " option[value=\"" + GLAccount + "\"]").prop("selected", true);
            if (GLAccount == "") { $("#GLAccount" + t).val(null).trigger("change"); }
        }
    }
    else {
        var htmlStr =
            '<tr>' +
            '   <td scope="row" style="padding:0px; text-align:center;"><img id="chk" src="DILibrary/images/remove-button-red.png" title="delete item"' +
            '       alt="del" onclick="gUtil.removeRow(this)"></td> ' +
            '   <td data-label="Item"><input type="text" class="inputData" id=\'ItemNumber0\' value="" title=""' +
            '       onclick="openForm(0)"><input type="hidden" id=\'ItemDescription0\' value="" /></td>' +
            '   <td data-label="Qty"><input type="text" class="inputData" id=\'Quantity0\' value="" onkeyup="gUtil.Calculate(\'0\')" ' +
            '       onkeypress="return gUtil.isNumberKey(event,this.id)"></td> ' +
            '   <td data-label="Unit $"><input type="text" class="inputData" id=\'UnitPrice0\' value="" onkeyup="gUtil.Calculate(\'0\')" ' +
            '       onkeypress="return gUtil.isNumberKey(event,this.id)"></td> ' +
            '   <td data-label="Ext $"><input type="text" id=\'InvoiceLineExtension0\' value="" readonly="true"></td>' +
            '   <td data-label="TAX Code"><input type="text" class="inputData" id=\'TaxCode0\' value="" title="" onblur="gUtil.CheckTaxCode(this.id)"></td>' +
            '   <td data-label="TAX"><input type="text" id=\'Tax0\' value="" readonly="true"></td>' +
            '   <td data-label="PO#"><input type="text" class="inputData" id=\'PONumber0\' value="" title = ""' +
            '       onkeypress="return gUtil.isNumberKey(event,this.id)"></td> ' +
            '   <td data-label="GL Account" ><select id=\"GLAccount0\" class="SelectGL">' + gUtil.GLAccountList +
            '       </select></td>' +
            '</tr>';

        TableBody.append(htmlStr);

        $("#GLAccount0 option[value=\"" + GLAccount + "\"]").prop("selected", true);
        if (GLAccount == "") { $("#GLAccount0").val(null).trigger("change"); }
    }
    $(".SelectGL").select2({ allowClear: true, width: '260px', placeholder: { text: '' } });
    //$(".SelectTaxCode").select2({ allowClear: true, width: '60px', placeholder: { text: '' } });
    $(".SelectGL").on('select2:open', function (e) { gUtil.toggleButton(false); });
    $('.SelectGL').on('select2:open', function (e) {
        var tabW = $('#invoice_details_table')[0].clientWidth;
        var pos = $(this).select('select2-container').position().left;
        $('.select2-dropdown').css('left', (tabW - 255 - pos) + 'px');
    });

    var subTotal = editor.ObjectVersionProperties.SearchForPropertyByAlias(Vault, "vProperty.subtotal", true).Value.DisplayValue;
    var balance = (subTotal != Total) ? "Not Balanced" : "Balanced";
    TableBody.append(
        '<tr>' +
        '<td style="text-align:center"><a id="addRow" href="#" title="Add Item" style="text-decoration: none;" ' +
        '       onclick="gUtil.addRowToTable(\'invoice_details_table\');"><strong>+</strong></a ></td > ' +
        '<td colspan="5"><div class="gp-balance" style="margin-right: 40px; float: right;">' +
        '   <label for="Total" id="Balanced" class="Balance ' + balance.split(" ").join("") + '" > ' + balance + '</label> ' +
        //'   <span id="totalSpan"><input type="text" id="Total" value="' + gUtil.CurrencyFormatter(Total) + '" readonly style="text-align: right; padding-right: 0px;"></span></div></td>' +
        '   <span id="TotalExt">' + gUtil.CurrencyFormatter(Total) + '</span></div></td>' +
        '<td data-label="TAX" ><input type="text" id="TotalTax" value="' + gUtil.CurrencyFormatter(TotalTax) + '" readonly="true"></td>' +
        '<td colspan="2"></td>' +
        '</tr>'
    );

    generate_addedRowX(editor.table, 'Detail Subtotal');
    //generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Subtotal');

    //generate_addedRow(editor.table, 'Freight');
    //generate_addedRow(editor.table, 'Detail Tax');
    //generate_addedRow(editor.table, 'Invoice Tax');
    //generate_addedRow(editor.table, 'Detail Total');
    //generate_addedRow(editor.table, 'Invoice Total');
    $(".inputData").click(function (event) { gUtil.toggleButton(false); });
}

function SetPODetails(controller) {
    var editor = controller.PurchaseOrder;
    if (editor == undefined) return;
    var Vault = controller.Vault;
    var tabname = 'PO' + editor.ObjectVersion.Title;
    var tabdisplayname = 'PO ' + editor.ObjectVersion.Title;

    CreateMetadataCard(controller, editor, "rtabs", tabname, tabdisplayname);

    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.PONumber')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Vendor')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.PODate')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.PORequiredDate')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Currency')

    var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
        FindObjects(Vault, 'vObject.PurchaseOrderDetail', 'vProperty.PurchaseOrder', MFDatatypeText, editor.ObjectVersion.Title), MFSearchFlagNone, true);
    if (ObjectSearchResults.Count > 0) {
        editor.table.append(
            '<tr><td colspan="5" align="center">' +
            '    <table width="90%" id="po_details_table" class="details">' +
            '        <tr><th width="7%">Line</th><th width="22%">Item</th><th>Ordered</th><th>RTD</th><th>Unit $</th><th width="18%">Ext $</th><th width="18%">TAX</th><th>Account</th></tr>' +
            '    </table>' +
            '</td></tr>' +
            '');

        var TableBody = editor.table.find('#po_details_table');
        var SearchResultsObjVers = ObjectSearchResults.GetAsObjectVersions().GetAsObjVers()
        var ObjectSearchResultsProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(SearchResultsObjVers);
        var Total = 0;
        var ArrayVal = [];
        var strTable = "";
        for (var i = 0; i < ObjectSearchResults.Count; i++) {
            var props = ObjectSearchResultsProperties[i];
            var LineNo = props.SearchForPropertyByAlias(Vault, "vProperty.POLine#", true).Value.DisplayValue;
            var PODetailName = props.SearchForPropertyByAlias(Vault, "vProperty.PurchaseOrderDetailName", true).Value.DisplayValue;
            var Item = props.SearchForPropertyByAlias(Vault, "vProperty.POItem", true).Value.DisplayValue;
            var ItemDesc = props.SearchForPropertyByAlias(Vault, "vProperty.POItemDescription", true).Value.DisplayValue;
            var ItemNO = Item.split("=>");
            var ItemVal = ItemNO[0];
            var OrdQty = props.SearchForPropertyByAlias(Vault, "vProperty.OrderedQty", true).Value.DisplayValue;
            var RTDQty = props.SearchForPropertyByAlias(Vault, "vProperty.ReceivedQty", true).Value.DisplayValue;
            var TAX = props.SearchForPropertyByAlias(Vault, "vProperty.TaxCode", true).Value.DisplayValue;
            var Price = props.SearchForPropertyByAlias(Vault, "vProperty.UnitPrice", true).Value.Value; //'$' + props.SearchForPropertyByAlias(Vault, "vProperty.UnitPrice", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var Amount = props.SearchForPropertyByAlias(Vault, "vProperty.POLineExtension", true).Value.Value;//.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var Account = props.SearchForPropertyByAlias(Vault, "vProperty.GLAccount", true).Value.DisplayValue;
            var AccountNO = Account.split(" ");
            Total = Total + props.SearchForPropertyByAlias(Vault, "vProperty.POLineExtension", true).Value.Value;
            strTable = '<tr>' +
                '<td style="text-align:center" title="' + PODetailName + '"><span id="LineNumber">' + LineNo + '</span></td>' +
                '<td style="text-align:left; word-wrap:break-word;" title="' + ItemDesc + '"><span id="ItemNumber">' + Item + '</span></td>' +
                '<td style="text-align:right"><span id="OrdQuantity">' + OrdQty + '</span></td>' +
                '<td style="text-align:right"><span id="RTDQuantity">' + RTDQty + '</span></td>' +
                '<td style="text-align:right"><span id="UnitPrice">' + gUtil.CurrencyFormatter(Price) + '</span></td>' +
                '<td style="text-align:right"><span id="Extension" title="' + gUtil.CurrencyFormatter(Amount) + '">' + gUtil.CurrencyFormatter(Amount) + '</span></td>' +
                '<td style="text-align:right"><span id="Extension" title="' + TAX + '">' + TAX + '</span></td>' +
                '<td style="text-align:right" title="' + AccountNO.slice(2).join(" ") + '"><span id="Account">' + AccountNO.slice(0, 1) + '</span></td>' +
                "</tr>";
            // HKo; sort the list: 1, 10, 11, 2, 3 => 1, 2, 3, 10
            ArrayVal[i] = LineNo + ", " + strTable;
        }
        var SortedList = gUtil.SortLineNo(ArrayVal).join();

        TableBody.append(SortedList);
        TableBody.append(
            '<tr>' +
            '<td colspan="7" style="text-align:right">' + gUtil.CurrencyFormatter(Total) + '</td>' +
            '</tr>'
        );
    }
}

function SetPSDetails(controller) {
    /* var editor=controller.PackingSlip;
     var Vault=controller.Vault;
     var tabname='PackingSlip';
     var tabdisplayname='Packing Slip';
 
     CreateMetadataCard(controller,editor,"rtabs",tabname,tabdisplayname);
 
     editor.table.append('<span>Packing Slip Details!</span>')*/

}

function ResetTabs() {
    $(".panel-left").empty();
    $(".panel-left").append('<div id="ltabs"><ul class="nav nav-tabs" role="tablist"></ul></div>');
    $(".panel-right").empty();
    $(".panel-right").append('<div id="rtabs"><ul class="nav nav-tabs" role="tablist"></ul></div>');
    $('#ltabs').tabs({
        activate: function (event, ui) {
            var tabID = ui.newPanel[0].id;
        }
    });
    $('#rtabs').tabs({
        activate: function (event, ui) {
            var tabID = ui.newPanel[0].id;
            if (tabID == 'InvPre') {
                LoadPreview();
            }
        }
    });
}

function RefreshTab() {
    SetDetails(gDashboard);
}

function SaveInvoice() {

    if (!gUtil.CheckNull()) {
        alert("The value(s) can not be empty");
        return;
    }

    gUtil.DestroyOldDetails();
    if (gUtil.CreateNewDetails()) {
        RefreshTab();
    }

};

function DiscardInvoice() {
    var result;
    var obj = (isPopup) ? gDashboard : gDashboard.Parent.shellFrame;

    result = obj.ShowMessage({
        caption: "Unsaved Changes",
        message: "You have unsaved changes to \"" + gDashboard.customData.ObjectVersion.Title + "\".",
        button1_title: "Save",
        button2_title: "Do Not Save",
        button3_title: "Cancel",
        defaultButton: 1
    });
    if (result == 1) SaveInvoice();     // save
    else if (result == 2) RefreshTab(); // don't save
}

// A helper function to compile the search conditions needed for running the search in the
// vault using M-Files API.
function FindObjects(Vault, OTAlias, PDAlias, PDType, Value) {
    // We need a few IDs based on aliases defined in the M-Files Admin tool for object types, properties, etc.
    // Note that all these methods could be run asynchronously as well, if it seems they take a long time and block the UI.
    var OT = Vault.ObjectTypeOperations.GetObjectTypeIDByAlias(OTAlias);
    var PD = Vault.PropertyDefOperations.GetPropertyDefIDByAlias(PDAlias);

    var oSC = new MFiles.SearchCondition();
    var oSCs = new MFiles.SearchConditions();

    // Search condition that defines the object is not marked as deleted.
    oSC.ConditionType = MFConditionTypeEqual;
    oSC.Expression.SetStatusValueExpression(MFStatusTypeDeleted, new MFiles.DataFunctionCall());
    oSC.TypedValue.SetValue(MFDatatypeBoolean, false);
    oSCs.Add(-1, oSC);

    // Search condition that defines the object type 
    oSC.ConditionType = MFConditionTypeEqual;
    oSC.Expression.SetStatusValueExpression(MFStatusTypeObjectTypeID, new MFiles.DataFunctionCall());
    oSC.TypedValue.SetValue(MFDatatypeLookup, OT);
    oSCs.Add(-1, oSC);

    // Search condition that defines that the object must refer to the given object.
    oSC.ConditionType = (PDAlias == "vProperty.GLAccountName") ? MFConditionTypeContains : MFConditionTypeEqual;
    oSC.Expression.DataPropertyValuePropertyDef = PD;
    oSC.TypedValue.SetValue(PDType, Value);
    oSCs.Add(-1, oSC);

    return oSCs;
}

function SetInvoicePreview() {

    var tablist = 'rtabs';
    var tabname = 'InvPre';
    var tabdisplayname = 'Invoice Preview';

    // Add the tab to the tab list
    $('<li class="nav-item"><a class="nav-link active" aria-selected="true" role="tab" href="#' + tabname + '" >' + tabdisplayname + '</a></li>').appendTo("#" + tablist + " ul");
    $('<div class="tab-content" id="' + tabname + '"><div class="tab-pane fade" id="' + tabname + '" role="tabpanel"></div></div>').appendTo("#" + tablist);
    $("#" + tablist).tabs("refresh");
}

function generate_row(tableID, Vault, ObjVerProperties, propertyAlias) {
    var propertyNumber = ObjVerProperties.SearchForPropertyByAlias(Vault, propertyAlias, true).PropertyDef;
    var PropertyDef = Vault.PropertyDefOperations.GetPropertyDef(propertyNumber);
    var propertyName = PropertyDef.Name;
    var propertyType = PropertyDef.DataType;
    var propertyValue = ObjVerProperties.SearchForPropertyByAlias(Vault, propertyAlias, true).Value.DisplayValue;
    var propertyEditable = (PropertyDef.AutomaticValueType == 0 ? 1 : 0);
    var classID = ObjVerProperties.SearchForProperty(MFBuiltInPropertyDefClass).TypedValue.getvalueaslookup().Item;
    var assocPropDefs = Vault.ClassOperations.GetObjectClass(classID).AssociatedPropertyDefs;
    var propertyRequired = gUtil.isRequired(assocPropDefs, propertyNumber);
    if (propertyType == 8)
        propertyValue = ((propertyValue == 'Yes') ? 'Yes' : 'No');
    if (propertyType == 3)
        propertyValue = '$' + propertyValue;
    // Create container element
    var propertyLine = $('<tr>');
    propertyLine.addClass('mf-dynamic-row mf-property-' + propertyNumber);
    propertyLine.attr('id', propertyNumber)
    // Check if field is editable. If it is, add class 'mf-editable'
    //if (propertyEditable)
    propertyLine.addClass('mf-editable');
    //	$(tableID).append(propertyLine);
    tableID.append(propertyLine);

    // Add hover handler (IE 10 css pseudo selector :hover is not detecting mouse leave events)
    propertyLine.hover(
        function () {
            // Set the hover theme. The special theme is set for workflow and workstates properties.
            $(this).addClass("ui-state-hover");
            if (propertyNumber == 38 || propertyNumber == 99)
                $(this).addClass("ui-footer-hover");
        },
        function () {

            // Remove the hover theme, as well as the special theme workflow and workstate properties.
            $(this).removeClass("ui-state-hover");
            if (propertyNumber == 38 || propertyNumber == 99)
                $(this).removeClass("ui-footer-hover");
        }
    );

    var line;
    if (propertyName == "Subtotal") {
        propertyName = "Invoice " + propertyName;
        propertyValue = gUtil.CurrencyFormatter(propertyValue.substring(1));
    }

    if (propertyName == "Verified") {
        var verifiedChk = (propertyValue == "No") ? "" : "checked";
        line = '<input type="checkbox" id="Verified" class="inputData"' + verifiedChk + '>';
    }
    else {

        line = '<div class="mf-internal-text mf-property-' + propertyNumber + '-text-0">' + propertyValue + '</div>';
    }


    var sub = (propertyName == "Invoice Subtotal") ?
        '<div><input type="hidden" id="hSubtotal" name="hSubtotal" value="' + propertyValue + '" disabled ></div> ' : "";

    propertyLine.append(
        '<td class="mf-dynamic-namefield">' +
        '    <div>' +
        '        <span class="mf-property-' + propertyNumber + '-label">' + propertyName + '</span>' +
        '        <span class="mf-required-indicator">*</span>' +
        '    </div>' +
        '</td>' +
        '<td colspan="4" class="mf-dynamic-controlfield">' +
        '    <div class="mf-control mf-dynamic-control mf-text">' +
        '        <div class="mf-internal-container">' + line + sub +
        '        </div>' +
        '    </div>' +
        '</td>'
    );


    if (!propertyRequired)
        requiredspan = propertyLine.find('.mf-required-indicator').hide();
}

function generate_addedRowXXX(tableID, propertyName) {

    var DitailSubtotal = $("#TotalExt").text().replace(/[^0-9.-]+/g, "");
    var InvoiceSubTotal = gUtil.controller.editor.ObjectVersionProperties.SearchForPropertyByAlias(gUtil.Vault, "vProperty.Subtotal", true).Value.DisplayValue;
    //var TaxCode = gUtil.TaxCode;
    var BalanceBG = "rgb(223, 248, 223)";
    var NotBalanceBG = "rgb(250, 215, 215)";
    var bgSubtotal = "";
    var propertyLine =
        '<tr class="TotalCost" >' +
        '   <td class="mf-dynamic-namefield"> <div><span>Detail Subtotal</span></td > ' +
        '   <td colspan="4"><div class="mf-internal-text"><span style="background-color:' + bgSubtotal + '">' + gUtil.CurrencyFormatter(DitailSubtotal) + '</span></div></td></tr>';
    tableID.append(propertyLine);
    generate_row(tableID, gUtil.Vault, gUtil.controller.editor.ObjectVersionProperties, 'vProperty.Subtotal');
    propertyLine =
        '<tr class="TotalCost">' +
        '   <td class="mf-dynamic-namefield"> <div><span>Freight</span></td > ' +
        '   <td class="mf-dynamic-namefield"><input type="text" id="FreightCost" value="$" class="inputData" onkeyup="gUtil.CalculateFreight()"; onkeypress="return gUtil.isNumberKeyWithCurrency(event,this.id)"></td>' +
        '   <td style="width:15%"><span style="padding-left:20px;padding-right:5px;line-height:20px">Tax Code</span></td>' +
        '   <td style="width:5%"><input type="text" id="FreightTaxCode" class="inputData" value="' + TaxCode + '" onblur="gUtil.CheckTaxCode(this.id);"></div></td>' +
        '   <td style="width:30%"><span style="padding-left:20px;padding-right:5px;line-height:20px">Tax:</span><span id="FreightTax"></span></td>';

    tableID.append(propertyLine);
}

function generate_addedRowX(tableID, propertyName) {

    var DetailSubtotal = gUtil.GetNumber($("#TotalExt").text());//.replace(/[^0-9.-]+/g, "");
    var InvoiceSubTotal = gUtil.controller.editor.ObjectVersionProperties.SearchForPropertyByAlias(gUtil.Vault, "vProperty.Subtotal", true).Value.DisplayValue;
    var DetailTax = gUtil.GetNumber($("#TotalTax")[0].value);//.replace(/[^0-9.-]+/g, "");  
    var InvoiceTax = gUtil.controller.editor.ObjectVersionProperties.SearchForPropertyByAlias(gUtil.Vault, "vProperty.Tax", true).Value.DisplayValue;
    var DetailTotal = parseFloat(DetailTax) + (DetailSubtotal != "") ? parseFloat(DetailSubtotal) : 0;
    var InvoiceTotal = gUtil.controller.editor.ObjectVersionProperties.SearchForPropertyByAlias(gUtil.Vault, "vProperty.Total", true).Value.DisplayValue;

    var BalanceBG = "rgb(223, 248, 223)";
    var NotBalanceBG = "rgb(250, 215, 215)";
    var bgSubtotal = (DetailSubtotal == InvoiceSubTotal) ? BalanceBG : NotBalanceBG;
    var bgTax = (DetailTax == InvoiceTax) ? BalanceBG : NotBalanceBG;
    var bgTotal = (DetailTotal == InvoiceTotal) ? BalanceBG : NotBalanceBG;
    DetailTotal = parseFloat(DetailSubtotal) + parseFloat(DetailTax);
    InvoiceTotal = parseFloat(InvoiceSubTotal) + parseFloat(InvoiceTax);
    var TC = (TaxCode == null) ? "" : TaxCode;
    var propertyLine =
        '<tr class="TotalCost" >' +
        '   <td class="mf-dynamic-namefield"> <div><span>Detail Subtotal</span></td > ' +
        '   <td colspan="4"><div class="mf-internal-text"><span id="DetailSubtotal" style="background-color:' + bgSubtotal + '">' + gUtil.CurrencyFormatter(DetailSubtotal) + '</span></div></td></tr>' +
        '<tr class="TotalCost" >' +
        '   <td class="mf-dynamic-namefield"> <div><span>Invoice Subtotal</span></td > ' +
        '   <td colspan="4"><div class="mf-internal-text"><span id="InvoiceSubtotal">' + gUtil.CurrencyFormatter(InvoiceSubTotal) + '</span></div>' +
        '       <div><input type="hidden" id="hSubtotal" name="hSubtotal" value="' + InvoiceSubTotal + '" disabled ></div></td></tr> ' +
        //tableID.append(propertyLine);
        //generate_row(tableID, gUtil.Vault, gUtil.controller.editor.ObjectVersionProperties, 'vProperty.Subtotal');
        //propertyLine =
        '<tr class="TotalCost">' +
        '   <td class="mf-dynamic-namefield"> <div><span>Freight</span></td > ' +
        '   <td class="mf-dynamic-namefield"><input type="text" id="FreightCost" value="$" class="inputData" onkeyup="gUtil.CalculateFreight()"; onkeypress="return gUtil.isNumberKeyWithCurrency(event,this.id)"></td>' +
        '   <td style="width:15%"><span style="padding-left:20px;padding-right:5px;line-height:20px">Tax Code</span></td>' +
        '   <td style="width:10%"><input type="text" id="FreightTaxCode" class="inputData" value="' + TC + '" onblur="gUtil.CheckTaxCode(this.id);"></div></td>' +
        '   <td style="width:30%"><span style="padding-left:20px;padding-right:5px;line-height:20px">Tax:</span><span id="FreightTax"></span></td>' +
        '<tr class="TotalCost">' +
        '   <td class="mf-dynamic-namefield"><div><span>Detail Tax</span></div></td>' +
        '   <td colspan="4"><div class="mf-internal-text"><span id="DetailTax" style="background-color:' + bgTax + '">' + gUtil.CurrencyFormatter(DetailTax) + '</span></div></td></tr>' +
        '<tr class="TotalCost">' +
        '   <td class="mf-dynamic-namefield"><div><span>Invoice Tax</span></div></td>' +
        '   <td colspan="4"><div class="mf-internal-text"><span id="InvoiceTax">' + gUtil.CurrencyFormatter(InvoiceTax) + '</span></div></td></tr>' +
        '<tr class="TotalCost">' +
        '   <td class="mf-dynamic-namefield"><div><span>Detail Total</span></div></td>' +
        '   <td colspan="4"><div class="mf-internal-text"><span id="DetailTotal" style="background-color:' + bgTotal + '">' + gUtil.CurrencyFormatter(DetailTotal) + '</span></div></td></tr>' +
        //'<tr class="TotalCost">' +
        //'   <td class="mf-dynamic-namefield"><div><span>Invoice Total</span></div></td>' +
        //'   <td colspan="4"><div class="mf-internal-text"><span id="InvoiceTotal">' + gUtil.CurrencyFormatter(InvoiceTotal) + '</span></div></td></tr>' +
        '<tr class="TotalCost">' +
        '   <td class="mf-dynamic-namefield"><div><span>Invoice Total</span></div></td>' +
        '   <td colspan="4"><div class="mf-internal-text"><span id="InvoiceTotal">' + gUtil.CurrencyFormatter(InvoiceTotal) + '</span></div></td></tr>';

    tableID.append(propertyLine);
    /*tableID.hover(
        function () {
            $(this).addClass("ui-state-hover");
        },
        function () {
            $(this).removeClass("ui-state-hover");
        }
    );*/
}

function generate_addedRow(tableID, propertyName) {

    // Create container elemehhnt
    var propertyLine = $('<tr>');
    var propertyNumber = 0;
    propertyLine.addClass('mf-dynamic-row');
    propertyLine.attr('id', propertyName)
    // Check if field is editable. If it is, add class 'mf-editable'
    propertyLine.addClass('mf-editable');
    //	$(tableID).append(propertyLine);
    tableID.append(propertyLine);

    // Add hover handler (IE 10 css pseudo selector :hover is not detecting mouse leave events)
    propertyLine.hover(
        function () {
            $(this).addClass("ui-state-hover");
        },
        function () {
            $(this).removeClass("ui-state-hover");
        }
    );

    var bottomLine = (propertyName == "TaxCode") ?
        '<div class="mf-internal-text"><input type="text" id="txt' + propertyName + '" value="" class="inputData" style="width:50%"></div>' :
        '<div class="mf-internal-text"><input type="text" id="txt' + propertyName + '" value="$" class="inputData" onkeypress="return gUtil.isNumberKeyWithCurrency(event,this.id)" style="width:50%"></div>';

    propertyLine.append(
        '<td class="mf-dynamic-namefield">' +
        '    <div>' +
        '        <span>' + propertyName + '</span>' +
        '    </div>' +
        '</td>' +
        '<td colspan="4" class="mf-dynamic-controlfield">' +
        '    <div class="mf-control mf-dynamic-control mf-text">' +
        '        <div class="mf-internal-container">' + bottomLine + '</div>' +
        '    </div>' +
        '</td>'
    );
}

function setProperty(Vault, editor, propertyAlias) {
    var ObjectVersionProperties = editor.ObjectVersionProperties
    var PropertyInfo = ObjectVersionProperties.SearchForPropertyByAlias(Vault, propertyAlias, true);
    var propertyNumber = PropertyInfo.PropertyDef;
    var PropertyDef = Vault.PropertyDefOperations.GetPropertyDef(propertyNumber);
    var propertyName = PropertyDef.Name;
    var propertyType = PropertyDef.DataType;
    var propertyValue = PropertyInfo.Value.DisplayValue;
    var propertyReadOnly = (PropertyDef.AutomaticValueType == 0 ? false : true);
    var classID = ObjectVersionProperties.SearchForProperty(MFBuiltInPropertyDefClass).TypedValue.getvalueaslookup().Item;
    var assocPropDefs = Vault.ClassOperations.GetObjectClass(classID).AssociatedPropertyDefs;
    var propertyRequired = gUtil.isRequired(assocPropDefs, propertyNumber);
    if (propertyType == 8)
        propertyValue = ((propertyValue == 'Yes') ? 'Yes' : 'No');
    if (propertyType == 3)
        propertyValue = '$' + propertyValue;

    var propertyObject = {
        AllowAdding: false,
        Events: editor.Events,
        Hierarchical: false,
        ID: PropertyDef,
        Label: propertyName,
        Linked: false,
        Modified: false,
        MustExist: true,
        PropertyDef: PropertyDef,
        ReadOnly: propertyReadOnly,
        RealObjectType: false,
        RealOTHierarchical: false,
        RealOTHierarchy: false,
        Type: propertyType,
        Value: propertyValue,
        valuelist: -2,
        ValueRequired: propertyRequired,
        Visible: true
    };
    return propertyObject
}

function CreateMetadataCard(controller, editor, tablist, tabid, tabtitle) {
    controller.editor = editor;
    var cardid = (typeof controller.cards === 'undefined') ? 0 : controller.cards + 1;
    controller.cards = cardid;
    editor.cardname = 'metadatacard-' + cardid;
    editor.tabname = tabid;
    editor.tabdisplayname = tabtitle;
    var active = (tablist == "ltabs") ? "active" : "";

    // Add the tab to the tab list
    $('<li class="nav-item"><a class="nav-link ' + active + '\" href="#' + editor.tabname + '" role="tab" data-toggle="tab" >' + editor.tabdisplayname + '</a></li>').appendTo("#" + tablist + " ul");
    $('<div class="tab-content" id="' + editor.tabname + '"><div class="tab-pane fade show active mf-metadatacard mf-mode-properties" id="' + editor.cardname + '"></div></div>').appendTo("#" + tablist);
    $("#" + tablist).tabs("refresh");

    var MetaCard = $('div #' + editor.cardname);
    MetaCard.addClass("mf-card-docked");

    var scroll = $(".panel-left").height() - 30;
    var mfsectionDiv = $('<div>');
    mfsectionDiv.addClass('mf-section mf-section-properties');
    mfsectionDiv.css('height', scroll);
    MetaCard.append(mfsectionDiv);

    var mfscrollableDiv = $('<div>');
    mfscrollableDiv.addClass('ui-scrollable');
    mfscrollableDiv.css('height', scroll);
    mfsectionDiv.append(mfscrollableDiv);

    var mfdynamicTab = $('<table>');
    mfdynamicTab.addClass('mf-dynamic-table');
    mfdynamicTab.attr('id', 'mf-property-table');
    mfdynamicTab.css("margin-bottom", "30px");
    mfscrollableDiv.append(mfdynamicTab);

    editor.metadatacard = MetaCard;
    editor.table = $('div #' + editor.cardname + ' #mf-property-table');
}

function CreateMetadataCard1(controller, editor, tablist, tabid, tabtitle) {
    var self = this;
    var Vault = controller.Vault;
    controller.editor = editor;
    var cardid = (typeof controller.cards === 'undefined') ? 0 : controller.cards + 1;
    controller.cards = cardid;
    editor.cardname = 'metadatacard-' + cardid;
    editor.tabname = tabid;
    editor.tabdisplayname = tabtitle;
    var active = (tablist == "ltabs") ? "active" : "";

    // Add the tab to the tab list
    $('<li class="nav-item"><a class="nav-link ' + active + '\" href="#' + editor.tabname + '" role="tab" data-toggle="tab" >' + editor.tabdisplayname + '</a></li>').appendTo("#" + tablist + " ul");
    $('<div class="tab-content" id="' + editor.tabname + '"><div class="tab-pane fade show active mf-metadatacard mf-mode-properties" id="' + editor.cardname + '"></div></div>').appendTo("#" + tablist);
    $("#" + tablist).tabs("refresh");

    var MetaCard = $('div #' + editor.cardname);
    MetaCard.addClass("mf-card-docked");

    var mfcontentDiv = $('<div>');
    mfcontentDiv.addClass('mf-content');
    mfcontentDiv.css('height', '100%');
    MetaCard.append(mfcontentDiv);

    var mfpropertiesviewDiv = $('<div>');
    mfpropertiesviewDiv.attr('id', 'mf-properties-view')
    mfcontentDiv.append(mfpropertiesviewDiv);

    var mfdynamiccontrolsDiv = $('<div>');
    mfdynamiccontrolsDiv.addClass('mf-dynamic-controls');
    mfpropertiesviewDiv.append(mfdynamiccontrolsDiv);

    var mfinternaldynamiccontrolsDiv = $('<div>');
    mfinternaldynamiccontrolsDiv.addClass('mf-internal-dynamic-controls');
    mfdynamiccontrolsDiv.append(mfinternaldynamiccontrolsDiv);

    var scroll = $(window).outerHeight() - $("#mf-footer").outerHeight() - $("#titleLabel").height() - 20;
    var mfsectionDiv = $('<div>');
    mfsectionDiv.addClass('mf-section mf-section-properties');
    mfinternaldynamiccontrolsDiv.append(mfsectionDiv);

    var mfscrollableDiv = $('<div>');
    mfscrollableDiv.addClass('ui-scrollable');
    //mfscrollableDiv.css('height', scroll + 'px');
    mfscrollableDiv.css('height', '700px');
    mfsectionDiv.append(mfscrollableDiv);

    var mfsectioncontentDiv = $('<div>');
    mfsectioncontentDiv.addClass('mf-section-content mf-dynamic-properties');
    mfsectioncontentDiv.attr('id', 'a' + cardid);
    mfscrollableDiv.append(mfsectioncontentDiv);

    var mfdynamicTab = $('<table>');
    mfdynamicTab.addClass('mf-dynamic-table');
    mfdynamicTab.attr('id', 'mf-property-table');
    mfdynamicTab.css("margin-bottom", "30px");
    mfsectioncontentDiv.append(mfdynamicTab);

    editor.metadatacard = MetaCard;
    editor.table = $('div #' + editor.cardname + ' #mf-property-table');
}

function LoadPreview() {
    var controller = gDashboard.CustomData;
    var editor = controller.Invoice;
    var Vault = controller.Vault;

    var tabname = 'InvPre';
    var ctrlContainer = $('#' + tabname);
    var filepath = "";

    var DisplaySearchCondition = new MFiles.SearchCondition();
    var DisplaySearchConditions = new MFiles.SearchConditions();

    DisplaySearchCondition.ConditionType = MFConditionTypeEqual;
    DisplaySearchCondition.Expression.DataPropertyValuePropertyDef = Vault.PropertyDefOperations.GetPropertyDefIDByAlias("vProperty.InvoiceName")
    DisplaySearchCondition.TypedValue.SetValue(MFDatatypeText, editor.ObjectVersionProperties[0].Value.DisplayValue);
    DisplaySearchConditions.Add(-1, DisplaySearchCondition);

    var DisplayResult = Vault.ObjectSearchOperations.SearchForObjectsByConditions(DisplaySearchConditions, MFSearchFlagNone, false);
    var doc = Vault.ObjectOperations.GetLatestObjectVersionAndProperties(DisplayResult[0].ObjVer.ObjID, false);
    var file = doc.VersionData.Files(1);
    filepath = Vault.ObjectFileOperations.GetPathInDefaultView(doc.VersionData.ObjVer.ObjID, doc.VersionData.ObjVer.Version, file.FileVer.ID, file.FileVer.Version);

    // EXTRA: Also show a preview of the document related to this Invoice object.
    // Add the ActiveX control to the DOM. Were are not using jQuery here to access the DOM, but would obviously
    // be an option. For details, see:
    // https://www.m-files.com/UI_Extensibility_Framework/#Embedding%20Shell%20Listings%20in%20Dashboards.html
    ctrlContainer.html('<object id="preview-ctrl" classid="clsid:' + MFiles.CLSID.PreviewerCtrl + '"> </object>');
    // Use the control to show the given file preview (path comes from whoever is embedding this dashboard, in this
    // case it is within a tab on shellFrame.RightPane).
    var previewCtrl = document.getElementById('preview-ctrl');
    previewCtrl.ShowFilePreview(filepath);
}

function CreatePopupIcon() {

    $('<li style="float:right"><a href="#" target="popup" onclick="PopupDashboard(); return false;");">' +
        '<img src="DILibrary/images/openlink_16.png"></a></li>').appendTo("#ltabs ul");
}

function PopupDashboard() {
    gDashboard.Parent.shellFrame.ShowPopupDashboard("APInvoice", true, gDashboard.CustomData);
    RefreshTab();
}

function openForm1(i) {

    var tbl = document.getElementById("invoice_details_table");
    if (tbl != null) {
        for (var i = 1; i < tbl.rows.length; i++) {
            tbl.rows[i].cells[1].onclick = function () { getval(i); };
        }
    }
}

function openForm(i) {

    var item = $("#ItemNumber" + i)[0].value;
    var itemDesc = $("#ItemDescription" + i)[0].value;
    if (itemDesc == undefined) itemDesc = "";

    var modalHtml =
        '<div class="modal-content">' +
        ' <span style="float:right; font-size:20px; cursor:pointer;" onclick="closeForm()">&times;</span><br/>' +
        '   <label for="item"><b>Item</b></label>' +
        '   <input type="text" id="item" value="' + item + '" required=required />' +

        '   <label for="desc" style="padding-top:10px"><b>Description</b></label>' +
        '   <input type="text" id="itemDescription" value="' + itemDesc + '"  />' +
        '   <br/>' +
        '       <button type="submit" class="btn" onclick="gUtil.StoreItemNDesc(' + i + ');">save</button>' +
        '       <button type="button" class="btn cancel" onclick="closeForm()">Close</button>' +
        '</div>';
    $("#popupItemDesc").append(modalHtml);

    var tbl = document.getElementById('invoice_details_table');
    var cell = tbl.rows[i + 1].cells[1];
    var modal = $("#popupItemDesc")[0].style;
    modal.display = "block";
    modal.top = "0px";
    modal.left = "0px";
    modal.width = $(".page-container").width() + "px";
    modal.height = $(".panel-left").height() + "px";

    if (cell.offsetTop + cell.offsetHeight + $(".modal-content").height() > $("#invoice_details_table").height())
        $(".modal-content").css("margin-top", (cell.offsetTop - $(".modal-content").height() - 25) + "px");
    else
        $(".modal-content").css("margin-top", (cell.offsetTop + $("#invoice_details_table tr").height() - 22) + "px");
    $(".modal-content").css("margin-left", (cell.offsetLeft + tbl.rows[i + 1].cells[0].offsetWidth) - 15 + "px");

    $("#item").focus();
}

function closeForm(val) {
    document.getElementById("popupItemDesc").style.display = "none";
    $("#popupItemDesc").empty();
    $("#invoice_details_table").focus();
    if (val) RefreshTab();
}

function openTaxInform() {
    var taxInfo = "";
    for (var i = 0; i < gUtil.TaxInfoArr.length; i++) {
        var taxCd = gUtil.TaxInfoArr[i][0];
        var taxDesc = gUtil.TaxInfoArr[i][1];
        taxInfo += '<tr><td>' + taxCd + '</td>' +
            '<td>' + taxDesc + '</td></tr>';
    }

    var modalHtml =
        '<div class="modal-content">' +
        '<span style="float:right; font-size:20px; cursor:pointer;" id="closeX">&times;</span><br />' +
        ' <table id="TaxInfoTable">' +
        '    <tr>' +
        '        <th>TaxCode</th>' +
        '        <th>Description</th>' +
        '    </tr>' + taxInfo +
        '</table>' +
        '</div>';
    $("#popupTaxInfo").append(modalHtml);

    //var tbl = document.getElementById('TaxInfoTable');
    var modal = $("#popupTaxInfo")[0].style;
    modal.display = "block";
    modal.top = "0px";
    modal.left = "0px";
    modal.width = $(".page-container").width() + "px";
    modal.height = $(".panel-left").height() + "px";
    $(".modal-content").css("width", "25%");

    $("#closeX").on("click", function () {
        document.getElementById("popupTaxInfo").style.display = "none";
        $("#popupTaxInfo").empty();
    });
}