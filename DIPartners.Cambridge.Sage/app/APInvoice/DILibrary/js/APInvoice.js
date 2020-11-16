//const { error } = require("jquery");
var gDashboard;
var gUtil;
var gNo;
var isPopup;

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

            var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
                FindObjects(Vault, 'vObject.PurchaseOrderDetail', 'vProperty.PurchaseOrder', MFDatatypeText, editor.ObjectVersion.Title), MFSearchFlagNone, true);
        }
    }

    controller.PackingSlip = {
        ObjectVersion: null,
        ObjectVersionProperties: null,
        PropertyControls: null,
        Events: dashboard.Events
    };

    gUtil.ResizeContentArea();
    //    gUtil.GetGLAccount();
    SetInvoiceDetails(controller);
    SetPODetails(controller);
    SetPSDetails(controller);
    $("#ltabs").tabs("option", "active", 0);
    $("#rtabs").tabs("option", "active", 0);
    if (!isPopup) CreatePopupIcon();
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
        '<tr><td colspan="6" align="center">' +
        '    <table width="90%" id="invoice_details_table" class="details">' +
        '       <tr><th width="5%">-</th><th width="20%">Item</th><th width="10%">Qty</th><th width="15%">Unit $</th>' +
        '           <th width="10%">Ext $</th><th width="10%">PO#</th><th width="15%">GL<br>Account</th></tr>' +
        '    </table>' +
        '</td></tr>' +
        '');
    var TableBody = editor.table.find('#invoice_details_table');
    var SearchResultsObjVers = ObjectSearchResults.GetAsObjectVersions().GetAsObjVers();
    var Total = 0

    if (ObjectSearchResults.Count > 0) {
        var ObjectSearchResultsProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(SearchResultsObjVers);
        for (var i = 0; i < ObjectSearchResults.Count; i++) {
            var props = ObjectSearchResultsProperties[i];
            var LineNo = props.SearchForPropertyByAlias(Vault, "vProperty.InvoiceLineNumber", true).Value.DisplayValue;
            var Item = props.SearchForPropertyByAlias(Vault, "vProperty.ItemNumber", true).Value.DisplayValue;
            var ItemDesc = props.SearchForPropertyByAlias(Vault, "vProperty.ItemDescription", true).Value.DisplayValue;
            var Qty = props.SearchForPropertyByAlias(Vault, "vProperty.Quantity", true).Value.DisplayValue;
            var Price = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.UnitPrice", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var Amount = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.InvoiceLineExtension", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var PONumber = props.SearchForPropertyByAlias(Vault, "vProperty.PurchaseOrderDetail", true).Value.DisplayValue;
            var GLAccount = props.SearchForPropertyByAlias(Vault, "vProperty.GLAccount", true).Value.DisplayValue;
            Total = Total + props.SearchForPropertyByAlias(Vault, "vProperty.InvoiceLineExtension", true).Value.Value
            gUtil.GetGLAccount(GLAccount);

            var htmlStr =
                '<tr>' +
                '   <td style="padding:0px; text-align:center"><img id="chk" src="DILibrary/images/remove-button-red.png" title="delete item"' +
                '       alt="del" onclick = "gUtil.removeRow(this)" ></td> ' +
                '   <td><input type="text" class="inputData" id=\'ItemNumber' + i + '\' value="' + Item + '" title="' + ItemDesc + '" ' +
                '       onclick="openForm(' + i + ')" ></td > ' +
                '   <input type="hidden" id=\'ItemDescription' + i + '\' value="' + ItemDesc + '" /> ' +
                '   <td><input type="text" class="inputData" id=\'Quantity' + i + '\' value="' + Qty + '" ' +
                '       onkeyup="gUtil.Calculate(\'Quantity' + i + '\', \'UnitPrice' + i + '\', \'InvoiceLineExtension' + i + '\')" ' +
                '       onkeypress="return gUtil.isNumberKey(event,this.id)"></td> ' +
                '   <td><input type="text" class="inputData" id=\'UnitPrice' + i + '\' value="' + Price + '" ' +
                '       onkeyup="gUtil.Calculate(\'Quantity' + i + '\', \'UnitPrice' + i + '\', \'InvoiceLineExtension' + i + '\')" ' +
                '       onkeypress="return gUtil.isNumberKey(event,this.id)"></td> ' +
                '   <td><input type="text" id=\'InvoiceLineExtension' + i + '\' value="' + Amount + '" readonly="true"></td>' +
                '   <td><input type="text" class="inputData" id=\'PONumber' + i + '\' ' +
                '       value="' + PONumber.split(" - ").pop().trim() + '" title = "' + PONumber + '"' +
                '       onkeypress="return gUtil.isNumberKey(event,this.id)"></td> ' +
                '   <td><select id=\"GLAccount' + i + '\" class="SelectGL">' + gUtil.GLAccountList +
                '       </select></td>' +
                '</tr>';
            TableBody.append(htmlStr);
            ArrayVal[i] = (PONumber == "") ? htmlStr : PONumber + ", " + htmlStr;
        }

        var SortedList = gUtil.SortLineNo(ArrayVal).join();
        //TableBody.append(SortedList);
    }
    else {
        var htmlStr =
            '<tr>' +
            '   <td style="padding:0px";><img id="chk" src="DILibrary/images/remove-button-red.png" ' +
            '        title="delete item" alt = "del" onclick = "gUtil.removeRow(this)" ></td > ' +
            '   <td style="text-align:left"><input type="text" class="inputData" id="ItemNumber0" value="" onclick="openForm(0)" ></td >' +
            '   <input type="hidden" id=\'ItemDescription0' + i + '\' value="" /> ' +
            '   <td><input type="text" class="inputData" id="Quantity0" value="" onkeyup="gUtil.Calculate(\'Quantity0\', \'UnitPrice0\', \'InvoiceLineExtension0\')" ' +
            '       onkeypress="return gUtil.isNumberKey(event,this.id)" ></td>' +
            '   <td><input type="text" class="inputData" id="UnitPrice0" value="" onkeyup="gUtil.Calculate(\'Quantity0\', \'UnitPrice0\', \'InvoiceLineExtension0\')" ' +
            '       onkeypress="return gUtil.isNumberKey(event,this.id)" ></td> ' +
            '   <td><input type="text" id="InvoiceLineExtension0" value="" readonly="true"></td>' +
            '   <td><input type="text" class="inputData" id="PONumber0" value="" onkeypress="return gUtil.isNumberKey(event,this.id)"></td>' +
            '   <td><select id=\"GLAccount0\" class="SelectGL">' + gUtil.GLAccountList +
            '       </select> ' +
            '   </td>' +
            '</tr>';

        TableBody.append(htmlStr);
    }

    $(".SelectGL").on('select2:open', function (e) {
        $(".SelectGL option[value='']").remove();
        gUtil.toggleButton(false);
    });
    $(".SelectGL").select2(
        {
            width: '260px',
            top: '20px',
            placeholder: { text: '' }
        });
    $(".inputData").click(function (event) { gUtil.toggleButton(false); });


    var subTotal = editor.ObjectVersionProperties.SearchForPropertyByAlias(Vault, "vProperty.subtotal", true).Value.DisplayValue;
    var balance = (subTotal != Total) ? "Not Balanced" : "Balanced";
    TableBody.append(
        '<tr>' +
        '<td style="text-align:center"><a id="addRow" href="#" title="Add Item" style="text-decoration: none;" ' +
        '       onclick=gUtil.addRowToTable("invoice_details_table");><strong>+</strong></a ></td > ' +
        '<td colspan="4" style="text-align:right; border-right: none; "><label id="Balanced" class="Balance ' + balance.split(" ").join("") + '">' + balance + '</label> ' +
        '<td colspan="2"><input type="text" id="Total" value="' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '" readonly></td>' +
        '</tr>'
    );
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Subtotal')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Verified')
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
            '        <tr><th width="7%">Line</th><th width="22%">Item</th><th>Ordered</th><th>RTD</th><th>Unit $</th><th width="18%">Ext $</th><th>Account</th></tr>' +
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
            var ItemNO = Item.split("=>");
            var ItemVal = ItemNO[0];
            var OrdQty = props.SearchForPropertyByAlias(Vault, "vProperty.OrderedQty", true).Value.DisplayValue;
            var RTDQty = props.SearchForPropertyByAlias(Vault, "vProperty.ReceivedQty", true).Value.DisplayValue;
            var Price = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.UnitPrice", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var Amount = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.POLineExtension", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var Account = props.SearchForPropertyByAlias(Vault, "vProperty.GLAccount", true).Value.DisplayValue;
            var AccountNO = Account.split(" ");
            Total = Total + props.SearchForPropertyByAlias(Vault, "vProperty.POLineExtension", true).Value.Value;
            strTable = '<tr>' +
                '<td style="text-align:center" title="' + PODetailName + '"><span id="LineNumber">' + LineNo + '</span></td>' +
                '<td style="text-align:left; word-wrap:break-word;" title="' + ItemNO[1] + '"><span id="ItemNumber">' + ItemNO[0] + '</span></td>' +
                '<td style="text-align:right"><span id="OrdQuantity">' + OrdQty + '</span></td>' +
                '<td style="text-align:right"><span id="RTDQuantity">' + RTDQty + '</span></td>' +
                '<td style="text-align:right"><span id="UnitPrice">' + Price + '</span></td>' +
                '<td style="text-align:right"><span id="Extension" title="' + Amount + '">' + Amount + '</span></td>' +
                '<td style="text-align:right" title="' + AccountNO.slice(2).join(" ") + '"><span id="Account">' + AccountNO.slice(0, 1) + '</span></td>' +
                "</tr>";
            // HKo; sort the list: 1, 10, 11, 2, 3 => 1, 2, 3, 10
            ArrayVal[i] = LineNo + ", " + strTable;
        }
        var SortedList = gUtil.SortLineNo(ArrayVal).join();

        TableBody.append(SortedList);
        TableBody.append(
            '<tr>' +
            '<td colspan="7" style="text-align:right">' +
            '$' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
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
    $(".panel-left").append('<div id="ltabs"><ul class="nav nav-tabs"></ul></div>');
    $(".panel-right").empty();
    $(".panel-right").append('<div id="rtabs"><ul class="nav nav-tabs role="tablist"></ul></div>');
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
    if (gUtil.CreateNewDetails()) RefreshTab();
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

function SetInvoicePreview1() {

    var tablist = 'rtabs';
    var tabname = 'InvPre';
    var tabdisplayname = 'Invoice Preview';

    // Add the tab to the tab list
    $('<li class="nav-item"><a class="nav-link active" aria-selected="true" role="tab" href="#' + tabname + '" onclick="javascript:LoadPreview()">' + tabdisplayname + '</a></li>').appendTo("#" + tablist + " ul");
    $('<div class="tab-content" id="' + tabname + '"><div class="tab-pane fade" id="' + tabname + '" role="tabpanel"></div></div>').appendTo("#" + tablist);
    $("#" + tablist).tabs("refresh");
}

function SetInvoicePreview() {

    var tablist = 'rtabs';
    var tabname = 'InvPre';
    var tabdisplayname = 'Invoice Preview';
    var tabUL =
        '<li class="nav-item" role = "presentation"> ' +
        '    <a class="nav-link active" id="invoice-tab" data-toggle="tab" href="#' + tabname + '" ' +
        '       role="tab" aria-controls="' + tabdisplayname + '" aria-selected="true" > ' + tabdisplayname + '</a > ' +
        '</li>';
    var tabDiv =
        '<div class="tab-content" id="' + tabname + '">' +
        '   <div class="tab-pane fade show active" id = "' + tabname + '" role = "tabpanel" aria-labelledby="' + tabname + '-tab"></div>' +
        '</div>';
    $(tabUL).appendTo("#" + tablist + " ul");
    $(tabDiv).appendTo("#" + tablist);

    // Add the tab to the tab list
    /*$('<li class="nav-item"><a class="nav-link active" aria-selected="true" role="tab" href="#' + tabname + '" onclick="javascript:LoadPreview()">' + tabdisplayname + '</a></li>').appendTo("#" + tablist + " ul");
    $('<div class="tab-content" id="' + tabname + '"><div class="tab-pane fade" id="' + tabname + '" role="tabpanel"></div></div>').appendTo("#" + tablist);
    $("#" + tablist).tabs("refresh");*/
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
    if (propertyEditable)
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
    var sub = (propertyName == "Subtotal") ?
        '                <div><input type="hidden" id="hSubtotal" name="hSubtotal" value="' + propertyValue + '" disabled ></div > ' : "";

    propertyLine.append(
        '        <td class="mf-dynamic-namefield">' +
        '            <div>' +
        '                <span class="mf-property-' + propertyNumber + '-label">' + propertyName + '</span>' +
        '                <span class="mf-required-indicator">*</span>' +
        '            </div>' +
        '        </td>' +
        '        <td colspan="4" class="mf-dynamic-controlfield">' +
        '            <div class="mf-control mf-dynamic-control mf-text">' +
        '                <div class="mf-internal-container">' +
        '                    <div class="mf-internal-text mf-property-' + propertyNumber + '-text-0">' + propertyValue + '</div>' + sub +
        '                </div>' +
        '            </div>' +
        '        </td>'
    );


    if (!propertyRequired)
        requiredspan = propertyLine.find('.mf-required-indicator').hide();
}

function generate_lookup(tableID, Vault, ObjVerProperties, propertyAlias) {
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
    var LookupContatainer = $('<div class="mf-internal-lookups"></div>');
    var divTag = $('<div class="mf-internal-lookup"></div>');
    LookupContatainer.append(divTag);
    LookupContatainer.addClass('mf-editable');
    //	$(tableID).append(propertyLine);
    tableID.append(LookupContatainer);

    var items = this.model.GetSelectableValueItemStates();

    // Enable each item if it is found from the array. 
    for (var index in items) {
        if (items[index] == this.COMPLETED_OR_APPROVED_ITEM_ID)
            this.isCompletedItemFound = true;
        else if (items[index] == this.REJECTED_ITEM_ID)
            this.isRejectedItemFound = true;
    }

    // Add hover handler (IE 10 css pseudo selector :hover is not detecting mouse leave events)
    LookupContatainer.hover(
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
    var sub = (propertyName == "Subtotal") ?
        '                <div><input type="hidden" id="hSubtotal" name="hSubtotal" value="' + propertyValue + '" disabled ></div > ' : "";

    LookupContatainer.append(
        '        <td class="mf-dynamic-namefield">' +
        '            <div>' +
        '                <span class="mf-property-' + propertyNumber + '-label">' + propertyName + '</span>' +
        '                <span class="mf-required-indicator">*</span>' +
        '            </div>' +
        '        </td>' +
        '        <td colspan="4" class="mf-dynamic-controlfield">' +
        '            <div class="mf-control mf-dynamic-control mf-text">' +
        '                <div class="mf-internal-container">' +
        '                    <div class="mf-internal-text mf-property-' + propertyNumber + '-text-0">' + propertyValue + '</div>' + sub +
        '                </div>' +
        '            </div>' +
        '        </td>'
    );


    if (!propertyRequired)
        requiredspan = LookupContatainer.find('.mf-required-indicator').hide();
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
    var self = this;
    var Vault = controller.Vault;
    controller.editor = editor;
    var cardid = (typeof controller.cards === 'undefined') ? 0 : controller.cards + 1;
    var toggleTab, active;
    controller.cards = cardid;
    editor.cardname = 'metadatacard-' + cardid;
    editor.tabname = tabid;
    editor.tabdisplayname = tabtitle;
    if (tablist == "rtabs") {
        toggleTab = ""
        active = "";
    }
    else {
        active = "active";
        toggleTab = "aria-selected=\"true\"";
    }


    var tabUL =
        '<li class="nav-item" role="presentation"> ' +
        '    <a class="nav-link ' + active + '" id="invoice-tab" data-toggle="tab" href="#' + editor.cardname + '" ' +
        '       role="tab" aria-controls="' + editor.tabdisplayname + '" ' + toggleTab + '> ' + editor.tabdisplayname + '</a> ' +
        '</li>';
    var tabDiv =
        '<div class="tab-content" id="' + editor.tabname + '">' +
        '   <div class="tab-pane fade show mf-metadatacard mf-mode-properties" id="' + editor.cardname + '" role="tabpanel" aria-labelledby="' + editor.tabname + '-tab"></div>' +
        '</div>';
    $(tabUL).appendTo("#" + tablist + " ul");
    $(tabDiv).appendTo("#" + tablist);


    // Add the tab to the tab list
    //$('<li class="nav-item"><a class="nav-link ' + active +'\" role="tab" href="#' + editor.tabname +'"' + toggleTab + '>'+editor.tabdisplayname+'</a></li>').appendTo("#" + tablist + " ul");
    //$('<div class="tab-content" id="' + editor.tabname + '"><div class="tab-pane fade show active mf-metadatacard mf-mode-properties" id="' + editor.cardname + '"></div></div>').appendTo("#" + tablist);
    $("#" + tablist).tabs("refresh");

    // Create and initialize metadatacard widget.
    //var metadatacard = $('#' + editor.cardname);
    //metadatacard.lookupcontrolcontainer({});
    //metadatacard.metadatacard("initialize", { apUtil: gUtil });

    var MetaCard = $('div #' + editor.cardname);
    MetaCard.addClass("mf-card-docked");

    var mfcontentDiv = $('<div>');
    mfcontentDiv.addClass('mf-content');
    mfcontentDiv.css('height', '700px');
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

    var mfsectionDiv = $('<div>');
    mfsectionDiv.addClass('mf-section mf-section-properties');
    mfinternaldynamiccontrolsDiv.append(mfsectionDiv);

    var mfscrollableDiv = $('<div>');
    mfscrollableDiv.addClass('ui-scrollable');
    mfscrollableDiv.css('height', '700px');
    mfsectionDiv.append(mfscrollableDiv);

    var mfsectioncontentDiv = $('<div>');
    mfsectioncontentDiv.addClass('mf-section-content mf-dynamic-properties');
    mfsectioncontentDiv.attr('id', 'a' + cardid);
    mfscrollableDiv.append(mfsectioncontentDiv);

    var mfdynamicTab = $('<table>');
    mfdynamicTab.addClass('mf-dynamic-table');
    mfdynamicTab.attr('id', 'mf-property-table');
    mfsectioncontentDiv.append(mfdynamicTab);

    // Bind click event to this element with 'metadatacard' namespace.
    MetaCard.bind("click.metadatacard", function (event) {
        //alert("Card Clicked!!!");
        // metadatacard.requestEditMode(null);
        //self.editManager.requestEditMode(null);
    });

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
        '</div >';
    $("#popupDesc").append(modalHtml);

    var tbl = document.getElementById('invoice_details_table');
    var cell = tbl.rows[i + 1].cells[1];
    var modal = $("#popupDesc")[0].style;
    modal.display = "block";
    modal.top = "0px";
    modal.left = "0px";
    modal.width = $(".page-container").width() + "px";
    modal.height = $(".panel-left").height() + "px";

    $(".modal-content").css("margin-top", (cell.offsetTop + $("#invoice_details_table tr").height() - 10) + "px");
    $(".modal-content").css("margin-left", (cell.offsetLeft + tbl.rows[i + 1].cells[0].offsetWidth + 10) + "px");

    $("#item").focus();
}

function closeForm(val) {
    document.getElementById("popupDesc").style.display = "none";
    $("#popupDesc").empty();
    if (val) RefreshTab();
}