// itt kurva sok időt basztam el, remélem megérte.. ugy utalok programozni hogy mindjart AI data centereket csinalok a lakasban
const adatok = ["Bence","Peti","Luki","Domi","Zsóti"];
const kereso = document.getElementById("kereso");
const talalatok = document.getElementById("talalatok");
function megjelenit(szoveg) {
    talalatok.replaceChildren();
    const szurt = adatok.filter(adat => adat.toLowerCase().includes(szoveg));
    for (const adat of szurt){
        const li = document.createElement("li");
        li.textContent = adat;
        talalatok.appendChild(li);
    }
}
kereso.addEventListener("input", () => {
    megjelenit(kereso.value.trim().toLowerCase());
});
megjelenit("");
const temaGomb = document.getElementById("tema")
temaGomb.addEventListener("click", () => {
    document.body.classList.toggle("sotet");
})
feladat1.addEventListener("click", () => {
    feladat_1()
})
feladat2.addEventListener("click", () => {
    feladat_2()
})
feladat3.addEventListener("click", () => {
    feladat_3()
})
feladat4.addEventListener("click", () => {
    feladat_4()
})
feladat5.addEventListener("click", () => {
    feladat_5()
})
feladat6.addEventListener("click", () => {
    feladat_6()
})
feladat7.addEventListener("click", () => {
    feladat_7()
})
feladat8.addEventListener("click", () => {
    feladat_8()
})
feladat10.addEventListener("click", () => {
    feladat_10()
})
function feladat_1() {
    for (let i = 0; i < 50; i +=1 ){
        if (i % 5 == 0) {
            console.log("Változó értéke: "+i);
        };
    }
    console.log("A függvény lefutott \n\n\n\n\n\n..........remélem helyesen")
};
function feladat_2() {
    szam = 100
    console.log("Változó értéke: "+szam)
    while (szam>1) {
        szam -= 10
        console.log("Változó értéke: "+szam)
    }
    console.log("A függvény lefutott \n\n\n\n\n\n..........remélem helyesen")
};
function feladat_3() {
    temp = 0
    const tomb = [6,1,7,3,9,45,8,16,7,33];
    for (let i = 0; i < 10; i+=1) {
        temp = temp + tomb[i];
        console.log("Változó értéke: "+temp)
    }
    console.log("Végeredmény(összeadás): "+temp);
    temp = temp / 10
    console.log("Végeredmény(átlag): "+temp);
    console.log("A függvény lefutott \n\n\n\n\n\n..........remélem helyesen");
};
function feladat_4() {
    const tomb = [6,1,7,3,9,45,8,16,7,33];
    vegeredmeny = tomb[0];
    for (let i = 1; i < 10; i+=1) {
        if (tomb[i]>vegeredmeny) {
            vegeredmeny = tomb[i];
        }
    }
    console.log("A legnagyobb szám a tömbben: "+vegeredmeny);
    console.log("A függvény lefutott \n\n\n\n\n\n..........remélem helyesen");
};
function feladat_5() {
// ez 1/1 amit beküldtél a doksiba, sajnálom de hát ha van egy tökéletes megoldás xd
    const mondat = "A reggeli kávé illata lassan betöltötte az egész konyhát, miközben az ablakon túl csendesen szemerkélt az eső.";
    betuk = "aá";
    let darab = 0;
    for (const betu of mondat.toLowerCase()){
        if (betuk.includes(betu)){
            darab++
        }
    }
    console.log("a és á betűk száma a példa mondatban: "+darab);
    console.log("A függvény lefutott \n\n\n\n\n\n..........remélem helyesen");
}
function feladat_6() {
    mondat = "A,reggel,kávé,illata";
    console.log("Az eredeti mondat: " + mondat)
    mondat = mondat.split(",");
    // Azért iratom ki szavanként hogy látható legyen hogy egy tömb, mert alapból nekem nem tűnt fel
    for(let i = 0;i < mondat.length;i+=1){
        console.log("Feldarabolt szavak: "+mondat[i]);
    }
    console.log("A függvény lefutott \n\n\n\n\n\n..........remélem helyesen");
}
function feladat_7() {
    const gomb = document.getElementById("feladat7");
    const uzenet = document.getElementById("uzenet");
    uzenet.classList.toggle("kiemelt");
    document.getElementById("uzenet2").classList.toggle("kiemelt");
    console.log("A függvény lefutott \n\n\n\n\n\n..........remélem helyesen");
}
function feladat_8() {
    const szavak = ["Bence","Peti","Luki","Domi","Zsóti"];
    const lista = document.getElementById("lista");
    for (const szo of szavak) {
        const elem = document.createElement("li");
        elem.textContent = szo;
        lista.appendChild(elem)
    }
    console.log("A függvény lefutott \n\n\n\n\n\n..........remélem helyesen");
}
