<style>
  .blue { color: dodgerblue; }
  .green { color: lightgreen; }
  .red { color: lightcoral; }
  .yellow { color: #fdfd96; }

  .link { color: dodgerblue; text-decoration: underline }

  .section { padding: 10px 0px }
</style>

### <span class="">**COVERAGE TEST SUMMARY \[{{tests.status}}\]**</span>
---

<div>
<div class="section">

{{summary.table}}

</div>
<div class="section">
<div style="display: inline-block; padding-right:10px">
<div>Test Suites:</div>
<div>Tests:</div>
<div>Snapshots:</div>
<div>Time:</div>
</div>
<div style="display: inline-block;">
<div>
<span class="green">{{summary.suites.pass}}</span>
<span class="yellow">{{summary.suites.pending}}</span>
<span class="red">{{summary.suites.fail}}</span>
{{summary.suites.total}} total
</div>
<div>
<span class="green">{{summary.tests.pass}}</span>
<span class="yellow">{{summary.tests.pending}}</span>
<span class="red">{{summary.tests.fail}}</span>
{{summary.tests.total}} total
</div>
<div>{{summary.snapshots.total}} totals</div>
<div>{{summary.time.total}}s</div>
</div>
</div>

<div class="section">
<details>
<summary class="link">Full Coverage Data</summary>
<div class="section">

### **Tests Files**

{{tests.review}}

</div>
<div class="section">

### **Coverage File Review**

{{details.table}}

</div>
</details>
</div>
</div>





